import type {
  EventVenueLayout,
  Venue,
  VenueTable,
  VenueZone,
} from '@prisma/client';
import { TABLE_LOCK_MINUTES } from './vip-venue.constants.js';
import { formatVenue } from '../venues/venues.formatter.js';
import {
  isTableLockActive,
  parseTableIncludes,
  parseTablePosition,
} from './venue-table.types.js';

export { formatPublicTicketOffering, formatTicketOffering } from '../ticket-offerings/ticket-offering.formatter.js';

type ZoneWithTables = VenueZone & { tables: VenueTable[] };
type LayoutWithZones = EventVenueLayout & { zones: ZoneWithTables[]; venue?: Venue | null };

function countZoneTables(zone: ZoneWithTables) {
  const total = zone.tables.length;
  const sold = zone.tables.filter((t) => t.status === 'sold').length;
  const available = zone.tables.filter(
    (t) => t.status === 'available' || (t.status === 'locked' && !isTableLockActive(t)),
  ).length;
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
    venue_id: layout.venueId ?? null,
    physical_venue: layout.venue ? formatVenue(layout.venue) : null,
    layout_venue_id: layout.id,
    event_id: layout.eventId,
    name: layout.venueName,
    table_lock_minutes: layout.tableLockMinutes ?? TABLE_LOCK_MINUTES,
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
  table: VenueTable,
  zone: VenueZone,
  userId?: string,
  now = new Date(),
): 'available' | 'sold' | 'premium' | 'locked' | 'selected' | 'reserved' {
  if (table.status === 'sold') return 'sold';
  if (zone.kind === 'vip_premium_zone') return 'premium';

  if (table.status === 'reserved') {
    return isTableLockActive(table, now) ? 'reserved' : 'available';
  }

  if (isTableLockActive(table, now)) {
    return table.lockedByUserId === userId ? 'selected' : 'locked';
  }

  return 'available';
}

export function formatVenueTable(
  table: VenueTable,
  zone: VenueZone,
  userId?: string,
  now = new Date(),
  eventCurrency?: string,
) {
  const apiStatus = resolveTableApiStatus(table, zone, userId, now);
  const includes = parseTableIncludes(table.includes);
  const position = parseTablePosition(table.position);
  const lockActive = isTableLockActive(table, now);

  return {
    id: table.externalId,
    table_id: table.id,
    event_id: table.eventId,
    number: table.number,
    label: table.label,
    zone_id: zone.externalId,
    zone_ref_id: zone.id,
    status: apiStatus,
    db_status: table.status,
    position,
    price: table.price,
    currency: eventCurrency ?? table.currency,
    capacity: table.capacity,
    includes: {
      people: table.capacity,
      bottles: includes.bottles,
      bar_vouchers: includes.bar_vouchers,
      extras: includes.extras,
    },
    is_premium: zone.kind === 'vip_premium_zone',
    locked_by_user_id: lockActive ? table.lockedByUserId : null,
    locked_until: lockActive ? table.lockedUntil?.toISOString() ?? null : null,
    locked_by_me: lockActive ? table.lockedByUserId === userId : false,
    sold_at: table.soldAt?.toISOString() ?? null,
    sold_to_user_id: table.soldToUserId ?? null,
  };
}

export function formatTableLockFromTable(table: VenueTable, now = new Date()) {
  if (!isTableLockActive(table, now) || !table.lockedUntil) {
    return {
      lock_id: null,
      table_id: table.id,
      status: 'NONE',
      locked_at: null,
      expires_at: null,
      expires_in_seconds: 0,
    };
  }

  return {
    lock_id: table.id,
    table_id: table.id,
    status: table.status === 'reserved' ? 'RESERVED' : 'ACTIVE',
    locked_at: table.updatedAt.toISOString(),
    expires_at: table.lockedUntil.toISOString(),
    expires_in_seconds: Math.max(
      0,
      Math.floor((table.lockedUntil.getTime() - now.getTime()) / 1000),
    ),
  };
}

export function formatTableLockStatus(table: VenueTable, userId?: string, now = new Date()) {
  if (!isTableLockActive(table, now) || !table.lockedUntil) {
    return {
      lock_id: null,
      status: 'NONE',
      locked_at: null,
      expires_at: null,
      remaining_seconds: 0,
      is_locked_by_me: false,
    };
  }

  return {
    lock_id: table.id,
    status: table.status === 'reserved' ? 'RESERVED' : 'ACTIVE',
    locked_at: table.updatedAt.toISOString(),
    expires_at: table.lockedUntil.toISOString(),
    remaining_seconds: Math.max(
      0,
      Math.floor((table.lockedUntil.getTime() - now.getTime()) / 1000),
    ),
    is_locked_by_me: userId ? table.lockedByUserId === userId : false,
  };
}
