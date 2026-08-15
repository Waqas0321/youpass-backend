import type { AdminVenueZone, AdminVenueZoneInput } from '../../api/client';

export const VIP_ZONE_KINDS = new Set(['vip_table_zone', 'vip_premium_zone']);

const ZONE_COLORS = ['#a855f7', '#f97316', '#f472b6', '#f2b705', '#22c55e', '#38bdf8'];

export function slugifyZoneExternalId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'vip-zone';
}

export function defaultZoneColor(index: number) {
  return ZONE_COLORS[index % ZONE_COLORS.length] ?? '#f2b705';
}

export function filterVipZones(zones: AdminVenueZone[]) {
  return zones.filter((zone) => VIP_ZONE_KINDS.has(zone.kind));
}

export function buildZoneInput(input: {
  name: string;
  color: string;
  capacityPerTable: number;
  displayOrder: number;
}): AdminVenueZoneInput {
  const externalId = slugifyZoneExternalId(input.name);

  return {
    external_id: externalId,
    name: input.name.trim(),
    kind: 'vip_table_zone',
    status: 'available',
    position_x: 10 + (input.displayOrder % 3) * 24,
    position_y: 10 + Math.floor(input.displayOrder / 3) * 28,
    size_width: 22,
    size_height: 22,
    color: input.color,
    capacity_per_table: input.capacityPerTable,
    is_selectable: true,
    display_order: input.displayOrder,
  };
}
