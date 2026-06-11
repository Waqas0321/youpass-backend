import type {
  EventTicketOffering,
  EventVenueLayout,
  TableLock,
  VenueTable,
  VenueZone,
} from '@prisma/client';

type ZoneWithTables = VenueZone & { tables: VenueTable[] };
type LayoutWithZones = EventVenueLayout & { zones: ZoneWithTables[] };
type TableWithLocks = VenueTable & { locks: TableLock[] };

export function formatTicketOffering(offering: EventTicketOffering, eventCurrency?: string) {
  return {
    id: offering.slug,
    offering_id: offering.id,
    slug: offering.slug,
    label: offering.label,
    description: offering.description,
    section: offering.section,
    price: offering.price,
    currency: eventCurrency ?? offering.currency,
    badge_label: offering.badgeLabel,
    display_order: offering.displayOrder,
    max_per_order: offering.maxPerOrder,
    maps_to_tier: offering.mapsToTier,
    maps_to_type: offering.mapsToType,
  };
}

function countZoneTables(zone: ZoneWithTables) {
  const total = zone.tables.length;
  const sold = zone.tables.filter((t) => t.status === 'sold').length;
  const available = zone.tables.filter((t) => t.status === 'available').length;
  return { total, sold, available };
}

export function formatVenueZone(zone: ZoneWithTables) {
  const counts = countZoneTables(zone);
  return {
    id: zone.externalId,
    zone_id: zone.id,
    name: zone.name,
    type: zone.kind,
    kind: zone.kind,
    position: { x: zone.positionX, y: zone.positionY },
    size: { width: zone.sizeWidth, height: zone.sizeHeight },
    color: zone.color,
    status: zone.status,
    table_capacity: zone.capacityPerTable,
    available_tables: counts.available,
    total_tables: counts.total,
    selectable: zone.isSelectable,
    is_selectable: zone.isSelectable,
  };
}

export function formatVenueLayout(layout: LayoutWithZones) {
  return {
    venue_id: layout.id,
    event_id: layout.eventId,
    name: layout.venueName,
    dimensions: {
      width_meters: layout.widthMeters,
      height_meters: layout.heightMeters,
    },
    dimensions_label: `${layout.widthMeters}m × ${layout.heightMeters}m`,
    zones: layout.zones
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((z) => formatVenueZone(z)),
  };
}

export function resolveTableApiStatus(
  table: TableWithLocks,
  userId?: string,
  now = new Date(),
): 'available' | 'sold' | 'premium' | 'locked' | 'selected' {
  if (table.status === 'sold') return 'sold';
  if (table.isPremium || table.status === 'premium') return 'premium';

  const activeLock = table.locks.find((l) => l.expiresAt > now);
  if (activeLock) {
    return activeLock.userId === userId ? 'selected' : 'locked';
  }

  return 'available';
}

export function formatVenueTable(
  table: TableWithLocks,
  zone: VenueZone,
  userId?: string,
  now = new Date(),
  eventCurrency?: string,
) {
  const apiStatus = resolveTableApiStatus(table, userId, now);
  const activeLock = table.locks.find((l) => l.expiresAt > now);

  return {
    id: table.externalId,
    table_id: table.id,
    number: table.number,
    label: table.label,
    zone_id: zone.externalId,
    zone_ref_id: zone.id,
    status: apiStatus,
    db_status: table.status,
    position: { x: table.positionX, y: table.positionY },
    price: table.price,
    currency: eventCurrency ?? table.currency,
    includes: {
      people: table.capacity,
      bottles: table.bottleCount,
      bar_vouchers: table.voucherCount,
      extras: [] as string[],
    },
    is_premium: table.isPremium,
    locked_until: activeLock?.expiresAt.toISOString() ?? null,
    locked_by_me: activeLock ? activeLock.userId === userId : false,
  };
}

export function formatTableLock(lock: TableLock) {
  return {
    lock_id: lock.id,
    table_id: lock.tableId,
    expires_at: lock.expiresAt.toISOString(),
    expires_in_seconds: Math.max(0, Math.floor((lock.expiresAt.getTime() - Date.now()) / 1000)),
  };
}
