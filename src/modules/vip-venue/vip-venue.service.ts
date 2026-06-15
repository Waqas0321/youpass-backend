import type { TableLock } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  getEventCurrencyMeta,
} from '../../common/services/country-config.service.js';
import { DEFAULT_SERVICE_FEE_RATE, TABLE_LOCK_MINUTES } from './vip-venue.constants.js';
import {
  formatTableLock,
  formatTableLockStatus,
  formatTicketOffering,
  formatVenueLayout,
  formatVenueTable,
  resolveOfferingAvailability,
  resolveTableApiStatus,
} from './vip-venue.formatter.js';

function isActiveLock(lock: TableLock, now = new Date()) {
  const statusOk = lock.status == null || lock.status === 'ACTIVE';
  return statusOk && lock.expiresAt > now;
}

const activeLockWhere = (now = new Date()) => ({
  expiresAt: { gt: now },
});

async function getTableLockMinutes(eventId: string) {
  const layout = await prisma.eventVenueLayout.findUnique({
    where: { eventId },
    select: { tableLockMinutes: true },
  });
  return layout?.tableLockMinutes ?? TABLE_LOCK_MINUTES;
}

export async function processExpiredTableLocks(now = new Date()): Promise<number> {
  const expired = await prisma.tableLock.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true },
  });

  if (expired.length === 0) {
    return 0;
  }

  const result = await prisma.tableLock.updateMany({
    where: { id: { in: expired.map((lock) => lock.id) } },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}

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
              locks: { where: activeLockWhere() },
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
      where: { eventId },
      orderBy: { displayOrder: 'asc' },
    });

    const now = new Date();
    const formatted = offerings
      .filter((offering) => {
        const availability = resolveOfferingAvailability(offering, now);
        if (availability.saleNotStarted) {
          return false;
        }
        return (
          offering.isActive ||
          offering.soldQuantity > 0 ||
          offering.stockQuantity != null
        );
      })
      .map((o) => formatTicketOffering(o, currencyMeta.currency, now));

    // Auto-deactivate offerings whose stock is fully sold.
    await Promise.all(
      offerings
        .filter(
          (offering) =>
            offering.isActive &&
            offering.stockQuantity != null &&
            offering.soldQuantity >= offering.stockQuantity,
        )
        .map((offering) =>
          prisma.eventTicketOffering.update({
            where: { id: offering.id },
            data: { isActive: false },
          }),
        ),
    );

    return {
      event_id: eventId,
      ...currencyMeta,
      service_fee_rate: DEFAULT_SERVICE_FEE_RATE,
      offerings: formatted,
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

    const activeLocks = table.locks.filter((l) => isActiveLock(l, now));
    const otherLock = activeLocks.find((l) => l.userId !== userId);
    if (otherLock) {
      throw new AppError(
        409,
        'TABLE_LOCKED',
        'This table is being reserved. Try again in a few minutes or choose another table.',
      );
    }

    const myLock = activeLocks.find((l) => l.userId === userId);
    if (myLock) {
      return {
        ...formatTableLock(myLock),
        table: formatVenueTable(table, zone, userId, now, currencyMeta.currency),
      };
    }

    const lockMinutes = await getTableLockMinutes(eventId);
    const expiresAt = new Date(now.getTime() + lockMinutes * 60 * 1000);

    const lock = await prisma.$transaction(async (tx) => {
      await tx.tableLock.updateMany({
        where: { tableId: table.id, expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      });

      return tx.tableLock.create({
        data: {
          tableId: table.id,
          userId,
          eventId,
          expiresAt,
          status: 'ACTIVE',
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

    await prisma.tableLock.updateMany({
      where: { tableId: table.id, userId, eventId, ...activeLockWhere() },
      data: { status: 'EXPIRED' },
    });

    return { released: true, table_id: table.externalId };
  },

  async getTableLockStatus(
    eventId: string,
    tableRef: string,
    userId?: string,
  ) {
    await getPublishedEvent(eventId);
    const { table } = await resolveTable(eventId, tableRef);
    const now = new Date();

    const lock = await prisma.tableLock.findFirst({
      where: {
        tableId: table.id,
        eventId,
        ...activeLockWhere(now),
      },
      orderBy: { expiresAt: 'desc' },
    });

    return formatTableLockStatus(lock, userId, now);
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
        ...activeLockWhere(now),
      },
    });

    if (!lock) {
      const lockMinutes = await getTableLockMinutes(eventId);
      throw new AppError(
        409,
        'TABLE_LOCK_REQUIRED',
        `Reserve the table first. Your ${lockMinutes}-minute hold may have expired.`,
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
      await tx.tableLock.updateMany({
        where: { tableId, ...activeLockWhere() },
        data: { status: 'CONSUMED' },
      });
    });
  },

  async getOfferingById(eventId: string, offeringRef: string) {
    const offering = await prisma.eventTicketOffering.findFirst({
      where: {
        eventId,
        OR: [{ id: offeringRef }, { slug: offeringRef }],
      },
    });

    if (!offering) {
      throw new AppError(404, 'TICKET_OFFERING_NOT_FOUND', 'Ticket offering not found');
    }

    const { is_selectable } = resolveOfferingAvailability(offering);
    if (!is_selectable) {
      throw new AppError(409, 'TICKET_OFFERING_SOLD_OUT', 'This ticket type is sold out');
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
      can_purchase: offeringsCount > 0 || Boolean(layout),
    };
  },

  async getEventAvailability(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'cancelled') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const offerings = await prisma.eventTicketOffering.findMany({
      where: { eventId, isActive: true },
    });

    const has_general_tickets = offerings.some((offering) => offering.section === 'general');
    const hasVipOfferings = offerings.some((offering) => offering.section === 'vip');

    const layout = await prisma.eventVenueLayout.findUnique({
      where: { eventId },
      include: {
        zones: {
          where: { isSelectable: true },
          include: { tables: true },
        },
      },
    });

    const hasAvailableVipTables =
      layout?.zones.some((zone) =>
        zone.tables.some((table) => table.status === 'available'),
      ) ?? false;

    const has_vip_tickets = hasVipOfferings || hasAvailableVipTables;
    const sellsTickets = offerings.length > 0 || Boolean(layout);
    const is_sold_out = sellsTickets && !has_general_tickets && !has_vip_tickets;

    return {
      event_id: eventId,
      is_sold_out,
      has_general_tickets,
      has_vip_tickets,
    };
  },
};
