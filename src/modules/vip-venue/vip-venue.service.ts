import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  getEventCurrencyMeta,
} from '../../common/services/country-config.service.js';
import { DEFAULT_SERVICE_FEE_RATE, TABLE_LOCK_MINUTES } from './vip-venue.constants.js';
import {
  formatTableLockFromTable,
  formatTableLockStatus,
  formatTicketOffering,
  formatVenueLayout,
  formatVenueTable,
  resolveTableApiStatus,
} from './vip-venue.formatter.js';
import {
  resolveOfferingAvailability,
  resolveOfferingRef,
} from '../ticket-offerings/ticket-offering.types.js';
import { isTableLockActive } from './venue-table.types.js';

async function getTableLockMinutes(eventId: string) {
  const layout = await prisma.eventVenueLayout.findUnique({
    where: { eventId },
    select: { tableLockMinutes: true },
  });
  return layout?.tableLockMinutes ?? TABLE_LOCK_MINUTES;
}

export async function processExpiredTableLocks(now = new Date()): Promise<number> {
  const expiredTables = await prisma.venueTable.updateMany({
    where: {
      status: { in: ['locked', 'reserved'] },
      lockedUntil: { lte: now },
    },
    data: {
      status: 'available',
      lockedByUserId: null,
      lockedUntil: null,
    },
  });

  await prisma.tableLock.updateMany({
    where: { expiresAt: { lte: now }, status: 'ACTIVE' },
    data: { status: 'EXPIRED' },
  });

  return expiredTables.count;
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
      venue: true,
      zones: {
        orderBy: { displayOrder: 'asc' },
        include: {
          tables: {
            orderBy: { number: 'asc' },
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
          offering.status === 'active' ||
          offering.status === 'sold_out' ||
          offering.stockTotal != null
        );
      })
      .map((o) => formatTicketOffering(o, currencyMeta.currency, now));

    await Promise.all(
      offerings
        .filter(
          (offering) =>
            offering.status === 'active' &&
            offering.stockRemaining != null &&
            offering.stockRemaining <= 0,
        )
        .map((offering) =>
          prisma.eventTicketOffering.update({
            where: { id: offering.id },
            data: { status: 'sold_out' },
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

    if (isTableLockActive(table, now) && table.lockedByUserId !== userId) {
      throw new AppError(
        409,
        'TABLE_LOCKED',
        'This table is being reserved. Try again in a few minutes or choose another table.',
      );
    }

    if (isTableLockActive(table, now) && table.lockedByUserId === userId) {
      return {
        ...formatTableLockFromTable(table, now),
        table: formatVenueTable(table, zone, userId, now, currencyMeta.currency),
      };
    }

    const lockMinutes = await getTableLockMinutes(eventId);
    const lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);

    const updatedTable = await prisma.$transaction(async (tx) => {
      await tx.tableLock.updateMany({
        where: { tableId: table.id, expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      });

      await tx.tableLock.create({
        data: {
          tableId: table.id,
          userId,
          eventId,
          expiresAt: lockedUntil,
          status: 'ACTIVE',
        },
      });

      return tx.venueTable.update({
        where: { id: table.id },
        data: {
          status: 'locked',
          lockedByUserId: userId,
          lockedUntil,
        },
      });
    });

    return {
      ...formatTableLockFromTable(updatedTable, now),
      table: formatVenueTable(updatedTable, zone, userId, now, currencyMeta.currency),
    };
  },

  async releaseTableLock(eventId: string, tableRef: string, userId: string) {
    await getPublishedEvent(eventId);
    const { table } = await resolveTable(eventId, tableRef);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.venueTable.updateMany({
        where: {
          id: table.id,
          eventId,
          lockedByUserId: userId,
          status: { in: ['locked', 'reserved'] },
        },
        data: {
          status: 'available',
          lockedByUserId: null,
          lockedUntil: null,
        },
      });

      await tx.tableLock.updateMany({
        where: {
          tableId: table.id,
          userId,
          eventId,
          expiresAt: { gt: now },
          status: 'ACTIVE',
        },
        data: { status: 'EXPIRED' },
      });
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
    return formatTableLockStatus(table, userId, new Date());
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
        status: resolveTableApiStatus(t, zone, userId, now),
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
    const table = await prisma.venueTable.findFirst({
      where: {
        id: tableId,
        eventId,
        lockedByUserId: userId,
        status: { in: ['locked', 'reserved'] },
        lockedUntil: { gt: now },
      },
    });

    if (!table) {
      const lockMinutes = await getTableLockMinutes(eventId);
      throw new AppError(
        409,
        'TABLE_LOCK_REQUIRED',
        `Reserve the table first. Your ${lockMinutes}-minute hold may have expired.`,
      );
    }

    return table;
  },

  async markTableSold(tableId: string, soldToUserId: string) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.venueTable.update({
        where: { id: tableId },
        data: {
          status: 'sold',
          soldAt: now,
          soldToUserId,
          lockedByUserId: null,
          lockedUntil: null,
        },
      });
      await tx.tableLock.updateMany({
        where: { tableId, status: 'ACTIVE' },
        data: { status: 'CONSUMED' },
      });
    });
  },

  async getOfferingById(eventId: string, offeringRef: string) {
    const typeRef = resolveOfferingRef(offeringRef);
    const offering = await prisma.eventTicketOffering.findFirst({
      where: {
        eventId,
        OR: [{ id: offeringRef }, ...(typeRef ? [{ type: typeRef }] : [])],
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
      prisma.eventTicketOffering.count({ where: { eventId, status: 'active' } }),
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
      where: { eventId, status: { in: ['active', 'sold_out'] } },
    });

    const has_general_tickets = offerings.some(
      (offering) => offering.type !== 'vip_general' && offering.status === 'active',
    );
    const hasVipOfferings = offerings.some(
      (offering) => offering.type === 'vip_general' && offering.status === 'active',
    );

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
