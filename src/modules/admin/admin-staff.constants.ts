export const STAFF_PERMISSIONS = [
  { id: 'scan_products', label: 'Scan products' },
  { id: 'scan_tickets', label: 'Scan tickets' },
  { id: 'view_statistics', label: 'View statistics' },
  { id: 'tickets_supervisor', label: 'Tickets supervisor' },
  { id: 'bar_supervisor', label: 'Bar / products supervisor' },
  { id: 'general_admin', label: 'General administrator' },
] as const;

/** Only two assignable scan roles: bar (drinks) and tickets (door). */
export const DEFAULT_STAFF_ROLES = [
  { slug: 'bar', label: 'Bar', color: '#9c5fd4', displayOrder: 1 },
  { slug: 'tickets', label: 'Tickets', color: '#5b9cf6', displayOrder: 2 },
] as const;

export const STAFF_ASSIGNABLE_ROLE_SLUGS = DEFAULT_STAFF_ROLES.map((role) => role.slug);

export const STAFF_SCAN_PERMISSION_IDS = ['scan_products', 'scan_tickets'] as const;

/** Legacy slugs treated as bar/tickets in admin and permission sync. */
export const LEGACY_BAR_ROLE_SLUGS = ['bar', 'bartender'] as const;
export const LEGACY_TICKETS_ROLE_SLUGS = ['tickets', 'general_access'] as const;

export const DEFAULT_STAFF_ZONES = [
  { slug: 'barra_principal', label: 'Barra Principal', displayOrder: 1 },
  { slug: 'acceso_general', label: 'Acceso General', displayOrder: 2 },
  { slug: 'vip_1', label: 'VIP 1', displayOrder: 3 },
  { slug: 'vip_2', label: 'VIP 2', displayOrder: 4 },
  { slug: 'zona_general', label: 'Zona General', displayOrder: 5 },
  { slug: 'backstage', label: 'Backstage', displayOrder: 6 },
] as const;

export const STAFF_PERMISSION_IDS = new Set<string>(
  STAFF_PERMISSIONS.map((permission) => permission.id),
);

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  bar: ['scan_products'],
  tickets: ['scan_tickets'],
  // Legacy slugs (existing staff records)
  bartender: ['scan_products'],
  general_access: ['scan_tickets'],
  vip_staff: ['scan_tickets', 'tickets_supervisor'],
  security: ['scan_tickets', 'view_statistics'],
  promoter: ['scan_tickets'],
  admin: ['scan_products', 'scan_tickets', 'view_statistics', 'bar_supervisor', 'tickets_supervisor'],
};
