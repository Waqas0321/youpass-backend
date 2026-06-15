import { z } from 'zod';

const adminVenueLayoutBaseSchema = z.object({
  venue_id: z.string().min(1).optional(),
  venue_name: z.string().min(1).max(200).optional(),
  width_meters: z.coerce.number().positive().optional(),
  height_meters: z.coerce.number().positive().optional(),
  table_lock_minutes: z.coerce.number().int().min(1).max(60).optional(),
});

export const adminVenueLayoutSchema = adminVenueLayoutBaseSchema.refine(
  (data) =>
    data.venue_id ||
    (data.venue_name && data.width_meters != null && data.height_meters != null),
  {
    message: 'Provide venue_id or venue_name with width_meters and height_meters',
  },
);

export const adminVenueLayoutUpdateSchema = adminVenueLayoutBaseSchema.partial();

export const adminVenueZoneSchema = z.object({
  external_id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  kind: z.enum(['vip_table_zone', 'vip_premium_zone', 'stage', 'general_floor']),
  status: z.enum(['available', 'premium', 'sold']).optional(),
  position_x: z.coerce.number().min(0),
  position_y: z.coerce.number().min(0),
  size_width: z.coerce.number().positive(),
  size_height: z.coerce.number().positive(),
  color: z.string().min(1).max(32),
  capacity_per_table: z.coerce.number().int().positive().optional().nullable(),
  is_selectable: z.boolean().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

export const adminVenueZoneUpdateSchema = adminVenueZoneSchema.partial();

const tableIncludesSchema = z.object({
  bottles: z.coerce.number().int().min(0).optional(),
  bar_vouchers: z.coerce.number().int().min(0).optional(),
  extras: z.array(z.string()).optional(),
});

const tablePositionSchema = z.object({
  x: z.coerce.number().min(0),
  y: z.coerce.number().min(0),
});

const adminVenueTableBaseSchema = z.object({
  external_id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  number: z.coerce.number().int().positive(),
  label: z.string().min(1).max(20),
  status: z.enum(['available', 'locked', 'reserved', 'sold']).optional(),
  position: tablePositionSchema.optional(),
  position_x: z.coerce.number().min(0).optional(),
  position_y: z.coerce.number().min(0).optional(),
  price: z.coerce.number().positive(),
  capacity: z.coerce.number().int().positive().optional(),
  includes: tableIncludesSchema.optional(),
  bottle_count: z.coerce.number().int().min(0).optional(),
  voucher_count: z.coerce.number().int().min(0).optional(),
  extras: z.array(z.string()).optional(),
});

export const adminVenueTableSchema = adminVenueTableBaseSchema.refine(
  (data) =>
    data.position != null ||
    (data.position_x != null && data.position_y != null),
  { message: 'Provide position or position_x and position_y' },
);

export const adminVenueTableUpdateSchema = adminVenueTableBaseSchema.partial();

export type AdminVenueLayoutInput = z.infer<typeof adminVenueLayoutSchema>;
export type AdminVenueZoneInput = z.infer<typeof adminVenueZoneSchema>;
export type AdminVenueTableInput = z.infer<typeof adminVenueTableSchema>;
