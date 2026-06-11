import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  getEventCurrencyMeta,
} from '../../common/services/country-config.service.js';
import { DEFAULT_SERVICE_FEE_RATE, TABLE_LOCK_MINUTES } from './vip-venue.constants.js';
import {
  formatTableLock,
  formatTicketOffering,
  formatVenueLayout,
  formatVenueTable,
  resolveTableApiStatus,
} from './vip-venue.formatter.js';

async function getPublishedEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== 'published') {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

async function getLayoutForEvent(eventId: string) {
  const layout = await prisma.eventVenueLayout.findUnique({
    where: { eventId },
    include: {
      zones: {
        orderBy: { displayOrder: 'asc' },
        include: {
          tables: {
            orderBy: { number: 'asc' },
            include: {
              locks: { where: { expiresAt: { gt: new Date() } } },
            },
          },
        },
      },
    },
  });

  if (!layout) {
    throw new AppError(404, 'VENUE_LAYOUT_NOT_FOUND', 'Venue layout is not configured for this event');
  }

  return layout;
}

async function resolveZone(eventId: string, zoneRef: string) {
  const layout = await getLayoutForEvent(eventId);
  const zone =
    layout.zones.find((z) => z.id === zoneRef || z.externalId === zoneRef) ?? null;

  if (!zone) {
    throw new AppError(404, 'VENUE_ZONE_NOT_FOUND', 'Venue zone not found');
  }

  return { layout, zone };
}

async function resolveTable(eventId: string, tableRef: string) {
  const layout = await getLayoutForEvent(eventId);

  for (const zone of layout.zones) {
    const table =
      zone.tables.find((t) => t.id === tableRef || t.externalId === tableRef) ?? null;
    if (table) {
      return { layout, zone, table };
    }
  }

  throw new AppError(404, 'VENUE_TABLE_NOT_FOUND', 'Venue table not found');
}

export const vipVenueService = {
  async listTicketTypes(eventId: string) {
    const event = await getPublishedEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const offerings = await prisma.eventTicketOffering.findMany({
      where: { eventId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      event_id: eventId,
      ...currencyMeta,
      service_fee_rate: DEFAULT_SERVICE_FEE_RATE,
      offerings: offerings.map((o) => formatTicketOffering(o, currencyMeta.currency)),
    };
  },

  async getVenueLayout(eventId: string) {
    await getPublishedEvent(eventId);
    const layout = await getLayoutForEvent(eventId);
    return formatVenueLayout(layout);
  },

  async listZoneTables(eventId: string, zoneRef: string, userId?: string) {
    const event = await getPublishedEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);
    const { zone } = await resolveZone(eventId, zoneRef);
    const now = new Date();

    const tables = zone.tables.map((t) =>
      formatVenueTable(t, zone, userId, now, currencyMeta.currency),
    );

    return {
      zone_id: zone.externalId,
      zone_ref_id: zone.id,
      zone_name: zone.name,
      table_capacity: zone.capacityPerTable,
      country_code: event.countryCode,
      currency: currencyMeta.currency,
      currency_decimals: currencyMeta.currency_decimals,
      tables,
    };
  },

  async getTable(eventId: string, tableRef: string, userId?: string) {
    const event = await getPublishedEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);
    const { zone, table } = await resolveTable(eventId, tableRef);
    return formatVenueTable(table, zone, userId, new Date(), currencyMeta.currency);
  },

  async lockTable(eventId: string, tableRef: string, userId: string) {
    const event = await getPublishedEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);
    const { zone, table } = await resolveTable(eventId, tableRef);
    const now = new Date();

    if (table.status === 'sold') {
      throw new AppError(409, 'TABLE_NOT_AVAILABLE', 'This table is already sold');
    }

    const activeLocks = table.locks.filter((l) => l.expiresAt > now);
    const otherLock = activeLocks.find((l) => l.userId !== userId);
    if (otherLock) {
      throw new AppError(409, 'TABLE_LOCKED', 'This table is temporarily held by another user');
    }

    const myLock = activeLocks.find((l) => l.userId === userId);
    if (myLock) {
      return {
        ...formatTableLock(myLock),
        table: formatVenueTable(table, zone, userId, now, currencyMeta.currency),
      };
    }

    const expiresAt = new Date(now.getTime() + TABLE_LOCK_MINUTES * 60 * 1000);

    const lock = await prisma.$transaction(async (tx) => {
      await tx.tableLock.deleteMany({
        where: { tableId: table.id, expiresAt: { lte: now } },
      });

      return tx.tableLock.create({
        data: {
          tableId: table.id,
          userId,
          eventId,
          expiresAt,
        },
      });
    });

    const refreshed = await resolveTable(eventId, table.id);

    return {
      ...formatTableLock(lock),
      table: formatVenueTable(refreshed.table, refreshed.zone, userId, now, currencyMeta.currency),
    };
  },

  async releaseTableLock(eventId: string, tableRef: string, userId: string) {
    await getPublishedEvent(eventId);
    const { table } = await resolveTable(eventId, tableRef);

    await prisma.tableLock.deleteMany({
      where: { tableId: table.id, userId, eventId },
    });

    return { released: true, table_id: table.externalId };
  },

  async getRealtimeAvailability(eventId: string, userId?: string) {
    await getPublishedEvent(eventId);
    const layout = await getLayoutForEvent(eventId);
    const now = new Date();

    const zones = layout.zones.map((zone) => {
      const tables = zone.tables.map((t) => ({
        id: t.externalId,
        table_id: t.id,
        label: t.label,
        status: resolveTableApiStatus(t, userId, now),
      }));

      return {
        zone_id: zone.externalId,
        zone_name: zone.name,
        available_tables: tables.filter((t) => t.status === 'available').length,
        locked_tables: tables.filter((t) => t.status === 'locked' || t.status === 'selected').length,
        sold_tables: tables.filter((t) => t.status === 'sold').length,
        tables,
      };
    });

    return {
      event_id: eventId,
      updated_at: now.toISOString(),
      zones,
    };
  },

  async assertUserTableLock(eventId: string, tableId: string, userId: string) {
    const now = new Date();
    const lock = await prisma.tableLock.findFirst({
      where: {
        tableId,
        userId,
        eventId,
        expiresAt: { gt: now },
      },
    });

    if (!lock) {
      throw new AppError(
        409,
        'TABLE_LOCK_REQUIRED',
        'Reserve the table first. Your 10-minute hold may have expired.',
      );
    }

    return lock;
  },

  async markTableSold(tableId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.venueTable.update({
        where: { id: tableId },
        data: { status: 'sold' },
      });
      await tx.tableLock.deleteMany({ where: { tableId } });
    });
  },

  async getOfferingById(eventId: string, offeringRef: string) {
    const offering = await prisma.eventTicketOffering.findFirst({
      where: {
        eventId,
        isActive: true,
        OR: [{ id: offeringRef }, { slug: offeringRef }],
      },
    });

    if (!offering) {
      throw new AppError(404, 'TICKET_OFFERING_NOT_FOUND', 'Ticket offering not found');
    }

    return offering;
  },

  async getPurchaseMeta(eventId: string) {
    const event = await getPublishedEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const [offeringsCount, layout] = await Promise.all([
      prisma.eventTicketOffering.count({ where: { eventId, isActive: true } }),
      prisma.eventVenueLayout.findUnique({ where: { eventId }, select: { id: true } }),
    ]);

    return {
      service_fee_rate: DEFAULT_SERVICE_FEE_RATE,
      ...currencyMeta,
      has_ticket_offerings: offeringsCount > 0,
      has_venue_layout: Boolean(layout),
    };
  },
};
