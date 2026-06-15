import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { venuesService } from '../venues/venues.service.js';
import { formatVenue } from '../venues/venues.formatter.js';
import { parseVenueDimensions } from '../venues/venues.types.js';
import { buildTableIncludes, parseTableIncludes, parseTablePosition } from '../vip-venue/venue-table.types.js';
import type {
  AdminVenueLayoutInput,
  AdminVenueTableInput,
  AdminVenueZoneInput,
} from './admin-venue-layout.validators.js';

function resolveAdminTablePosition(input: AdminVenueTableInput) {
  if (input.position) {
    return { x: input.position.x, y: input.position.y };
  }
  return { x: input.position_x ?? 0, y: input.position_y ?? 0 };
}

function resolveAdminTableIncludes(input: AdminVenueTableInput, zoneKind: string) {
  return buildTableIncludes({
    bottles: input.includes?.bottles ?? input.bottle_count ?? (zoneKind === 'vip_premium_zone' ? 3 : 2),
    bar_vouchers:
      input.includes?.bar_vouchers ?? input.voucher_count ?? (zoneKind === 'vip_premium_zone' ? 30 : 20),
    extras: input.includes?.extras ?? input.extras ?? (zoneKind === 'vip_premium_zone' ? ['premium_service'] : []),
  });
}

async function assertEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

async function assertLayoutForEvent(eventId: string) {
  const layout = await prisma.eventVenueLayout.findUnique({
    where: { eventId },
    include: {
      zones: {
        orderBy: { displayOrder: 'asc' },
        include: {
          tables: { orderBy: { number: 'asc' } },
        },
      },
    },
  });
  if (!layout) {
    throw new AppError(404, 'VENUE_LAYOUT_NOT_FOUND', 'Venue layout not configured for this event');
  }
  return layout;
}

async function resolveZone(layoutId: string, zoneRef: string) {
  const zone = await prisma.venueZone.findFirst({
    where: {
      layoutId,
      OR: [{ id: zoneRef }, { externalId: zoneRef }],
    },
  });
  if (!zone) {
    throw new AppError(404, 'VENUE_ZONE_NOT_FOUND', 'Venue zone not found');
  }
  return zone;
}

async function resolveTable(zoneId: string, tableRef: string) {
  const table = await prisma.venueTable.findFirst({
    where: {
      zoneId,
      OR: [{ id: tableRef }, { externalId: tableRef }, { label: tableRef }],
    },
  });
  if (!table) {
    throw new AppError(404, 'VENUE_TABLE_NOT_FOUND', 'Venue table not found');
  }
  return table;
}

function formatAdminTable(
  table: {
    id: string;
    eventId: string;
    externalId: string;
    number: number;
    label: string;
    status: string;
    position: unknown;
    price: number;
    currency: string;
    capacity: number;
    includes: unknown;
    lockedByUserId?: string | null;
    lockedUntil?: Date | null;
    soldAt?: Date | null;
    soldToUserId?: string | null;
  },
  currency?: string,
) {
  const includes = parseTableIncludes(table.includes);
  const position = parseTablePosition(table.position);
  return {
    table_id: table.id,
    event_id: table.eventId,
    external_id: table.externalId,
    number: table.number,
    label: table.label,
    status: table.status,
    position,
    position_x: position.x,
    position_y: position.y,
    price: table.price,
    currency: currency ?? table.currency,
    capacity: table.capacity,
    includes,
    bottle_count: includes.bottles,
    voucher_count: includes.bar_vouchers,
    extras: includes.extras,
    locked_by_user_id: table.lockedByUserId ?? null,
    locked_until: table.lockedUntil?.toISOString() ?? null,
    sold_at: table.soldAt?.toISOString() ?? null,
    sold_to_user_id: table.soldToUserId ?? null,
  };
}

function formatAdminZone(
  zone: {
    id: string;
    externalId: string;
    name: string;
    kind: string;
    status: string;
    positionX: number;
    positionY: number;
    sizeWidth: number;
    sizeHeight: number;
    color: string;
    capacityPerTable: number | null;
    isSelectable: boolean;
    displayOrder: number;
    tables: Array<{
      id: string;
      eventId: string;
      externalId: string;
      number: number;
      label: string;
      status: string;
      position: unknown;
      price: number;
      currency: string;
      capacity: number;
      includes: unknown;
      lockedByUserId?: string | null;
      lockedUntil?: Date | null;
      soldAt?: Date | null;
      soldToUserId?: string | null;
    }>;
  },
  currency?: string,
) {
  const soldTables = zone.tables.filter((table) => table.status === 'sold').length;
  const availableTables = zone.tables.filter((table) => table.status === 'available').length;

  return {
    zone_id: zone.id,
    external_id: zone.externalId,
    name: zone.name,
    kind: zone.kind,
    status: zone.status,
    position_x: zone.positionX,
    position_y: zone.positionY,
    size_width: zone.sizeWidth,
    size_height: zone.sizeHeight,
    color: zone.color,
    capacity_per_table: zone.capacityPerTable,
    is_selectable: zone.isSelectable,
    display_order: zone.displayOrder,
    total_tables: zone.tables.length,
    available_tables: availableTables,
    sold_tables: soldTables,
    tables: zone.tables.map((table) => formatAdminTable(table, currency)),
  };
}

async function resolveLayoutFields(input: AdminVenueLayoutInput) {
  if (input.venue_id) {
    const venue = await venuesService.resolveForLink(input.venue_id);
    const dimensions = parseVenueDimensions(venue.dimensions);
    return {
      venueId: venue.id,
      venueName: input.venue_name?.trim() ?? venue.name,
      widthMeters: input.width_meters ?? dimensions.width_meters,
      heightMeters: input.height_meters ?? dimensions.height_meters,
    };
  }

  if (!input.venue_name || input.width_meters == null || input.height_meters == null) {
    throw new AppError(
      400,
      'INVALID_VENUE_LAYOUT',
      'Provide venue_id or venue_name with width_meters and height_meters',
    );
  }

  return {
    venueId: null,
    venueName: input.venue_name.trim(),
    widthMeters: input.width_meters,
    heightMeters: input.height_meters,
  };
}

function formatAdminLayout(
  layout: {
    id: string;
    eventId: string;
    venueId?: string | null;
    venueName: string;
    widthMeters: number;
    heightMeters: number;
    tableLockMinutes: number;
    venue?: Parameters<typeof formatVenue>[0] | null;
    zones: Array<Parameters<typeof formatAdminZone>[0]>;
  },
  currency?: string,
) {
  const allTables = layout.zones.flatMap((zone) => zone.tables);
  return {
    layout_id: layout.id,
    event_id: layout.eventId,
    venue_id: layout.venueId ?? null,
    physical_venue: layout.venue ? formatVenue(layout.venue) : null,
    venue_name: layout.venueName,
    width_meters: layout.widthMeters,
    height_meters: layout.heightMeters,
    table_lock_minutes: layout.tableLockMinutes,
    dimensions: {
      width_meters: layout.widthMeters,
      height_meters: layout.heightMeters,
    },
    total_zones: layout.zones.length,
    total_tables: allTables.length,
    available_tables: allTables.filter((table) => table.status === 'available').length,
    sold_tables: allTables.filter((table) => table.status === 'sold').length,
    zones: layout.zones.map((zone) => formatAdminZone(zone, currency)),
  };
}

export const adminVenueLayoutService = {
  async getLayout(eventId: string) {
    const event = await assertEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const layout = await prisma.eventVenueLayout.findUnique({
      where: { eventId },
      include: {
        venue: true,
        zones: {
          orderBy: { displayOrder: 'asc' },
          include: {
            tables: { orderBy: { number: 'asc' } },
          },
        },
      },
    });

    if (!layout) {
      return { event_id: eventId, layout: null };
    }

    return {
      event_id: eventId,
      layout: formatAdminLayout(layout, currencyMeta.currency),
    };
  },

  async upsertLayout(eventId: string, input: AdminVenueLayoutInput) {
    const event = await assertEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);
    const resolved = await resolveLayoutFields(input);

    const layout = await prisma.eventVenueLayout.upsert({
      where: { eventId },
      create: {
        eventId,
        venueId: resolved.venueId,
        venueName: resolved.venueName,
        widthMeters: resolved.widthMeters,
        heightMeters: resolved.heightMeters,
        tableLockMinutes: input.table_lock_minutes ?? 10,
      },
      update: {
        venueId: resolved.venueId,
        venueName: resolved.venueName,
        widthMeters: resolved.widthMeters,
        heightMeters: resolved.heightMeters,
        ...(input.table_lock_minutes != null
          ? { tableLockMinutes: input.table_lock_minutes }
          : {}),
      },
      include: {
        venue: true,
        zones: {
          orderBy: { displayOrder: 'asc' },
          include: { tables: { orderBy: { number: 'asc' } } },
        },
      },
    });

    return formatAdminLayout(layout, currencyMeta.currency);
  },

  async deleteLayout(eventId: string) {
    await assertEvent(eventId);
    const existing = await prisma.eventVenueLayout.findUnique({ where: { eventId } });
    if (!existing) {
      throw new AppError(404, 'VENUE_LAYOUT_NOT_FOUND', 'Venue layout not configured for this event');
    }
    await prisma.eventVenueLayout.delete({ where: { eventId } });
    return { deleted: true, layout_id: existing.id };
  },

  async createZone(eventId: string, input: AdminVenueZoneInput) {
    const event = await assertEvent(eventId);
    const layout = await assertLayoutForEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const zone = await prisma.venueZone.create({
      data: {
        layoutId: layout.id,
        externalId: input.external_id,
        name: input.name,
        kind: input.kind,
        status: input.status ?? 'available',
        positionX: input.position_x,
        positionY: input.position_y,
        sizeWidth: input.size_width,
        sizeHeight: input.size_height,
        color: input.color,
        capacityPerTable: input.capacity_per_table ?? null,
        isSelectable: input.is_selectable ?? input.kind !== 'stage',
        displayOrder: input.display_order ?? layout.zones.length,
      },
      include: { tables: { orderBy: { number: 'asc' } } },
    });

    return formatAdminZone(zone, currencyMeta.currency);
  },

  async updateZone(eventId: string, zoneRef: string, input: Partial<AdminVenueZoneInput>) {
    const event = await assertEvent(eventId);
    const layout = await assertLayoutForEvent(eventId);
    const existing = await resolveZone(layout.id, zoneRef);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const zone = await prisma.venueZone.update({
      where: { id: existing.id },
      data: {
        ...(input.external_id != null ? { externalId: input.external_id } : {}),
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.kind != null ? { kind: input.kind } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.position_x != null ? { positionX: input.position_x } : {}),
        ...(input.position_y != null ? { positionY: input.position_y } : {}),
        ...(input.size_width != null ? { sizeWidth: input.size_width } : {}),
        ...(input.size_height != null ? { sizeHeight: input.size_height } : {}),
        ...(input.color != null ? { color: input.color } : {}),
        ...(input.capacity_per_table !== undefined
          ? { capacityPerTable: input.capacity_per_table }
          : {}),
        ...(input.is_selectable != null ? { isSelectable: input.is_selectable } : {}),
        ...(input.display_order != null ? { displayOrder: input.display_order } : {}),
      },
      include: { tables: { orderBy: { number: 'asc' } } },
    });

    return formatAdminZone(zone, currencyMeta.currency);
  },

  async deleteZone(eventId: string, zoneRef: string) {
    const layout = await assertLayoutForEvent(eventId);
    const existing = await resolveZone(layout.id, zoneRef);
    await prisma.venueZone.delete({ where: { id: existing.id } });
    return { deleted: true, zone_id: existing.id };
  },

  async createTable(eventId: string, zoneRef: string, input: AdminVenueTableInput) {
    const event = await assertEvent(eventId);
    const layout = await assertLayoutForEvent(eventId);
    const zone = await resolveZone(layout.id, zoneRef);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const table = await prisma.venueTable.create({
      data: {
        eventId,
        zoneId: zone.id,
        externalId: input.external_id,
        number: input.number,
        label: input.label,
        status: input.status ?? 'available',
        position: resolveAdminTablePosition(input),
        price: input.price,
        currency: currencyMeta.currency,
        capacity: input.capacity ?? zone.capacityPerTable ?? 10,
        includes: resolveAdminTableIncludes(input, zone.kind),
      },
    });

    return formatAdminTable(table, currencyMeta.currency);
  },

  async updateTable(
    eventId: string,
    zoneRef: string,
    tableRef: string,
    input: Partial<AdminVenueTableInput>,
  ) {
    const event = await assertEvent(eventId);
    const layout = await assertLayoutForEvent(eventId);
    const zone = await resolveZone(layout.id, zoneRef);
    const existing = await resolveTable(zone.id, tableRef);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const existingIncludes = parseTableIncludes(existing.includes);
    const existingPosition = parseTablePosition(existing.position);
    const includes =
      input.includes != null ||
      input.bottle_count != null ||
      input.voucher_count != null ||
      input.extras != null
        ? resolveAdminTableIncludes(
            {
              external_id: existing.externalId,
              number: existing.number,
              label: existing.label,
              position_x: existingPosition.x,
              position_y: existingPosition.y,
              price: existing.price,
              bottle_count: input.bottle_count ?? input.includes?.bottles ?? existingIncludes.bottles,
              voucher_count:
                input.voucher_count ?? input.includes?.bar_vouchers ?? existingIncludes.bar_vouchers,
              extras: input.extras ?? input.includes?.extras ?? existingIncludes.extras,
            },
            zone.kind,
          )
        : undefined;

    const table = await prisma.venueTable.update({
      where: { id: existing.id },
      data: {
        ...(input.external_id != null ? { externalId: input.external_id } : {}),
        ...(input.number != null ? { number: input.number } : {}),
        ...(input.label != null ? { label: input.label } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.position != null || input.position_x != null || input.position_y != null
          ? {
              position: resolveAdminTablePosition({
                position: input.position,
                position_x: input.position_x ?? existingPosition.x,
                position_y: input.position_y ?? existingPosition.y,
                external_id: existing.externalId,
                number: existing.number,
                label: existing.label,
                price: existing.price,
              }),
            }
          : {}),
        ...(input.price != null ? { price: input.price } : {}),
        ...(input.capacity != null ? { capacity: input.capacity } : {}),
        ...(includes != null ? { includes } : {}),
      },
    });

    return formatAdminTable(table, currencyMeta.currency);
  },

  async deleteTable(eventId: string, zoneRef: string, tableRef: string) {
    const layout = await assertLayoutForEvent(eventId);
    const zone = await resolveZone(layout.id, zoneRef);
    const existing = await resolveTable(zone.id, tableRef);
    await prisma.venueTable.delete({ where: { id: existing.id } });
    return { deleted: true, table_id: existing.id };
  },
};
