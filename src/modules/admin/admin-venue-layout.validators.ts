import { z } from 'zod';

export const adminVenueLayoutSchema = z.object({
  venue_name: z.string().min(1).max(120),
  width_meters: z.coerce.number().positive(),
  height_meters: z.coerce.number().positive(),
  table_lock_minutes: z.coerce.number().int().min(1).max(60).optional(),
});

export const adminVenueLayoutUpdateSchema = adminVenueLayoutSchema.partial();

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

export const adminVenueTableSchema = z.object({
  external_id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  number: z.coerce.number().int().positive(),
  label: z.string().min(1).max(32),
  status: z.enum(['available', 'sold', 'premium']).optional(),
  position_x: z.coerce.number().min(0),
  position_y: z.coerce.number().min(0),
  price: z.coerce.number().positive(),
  capacity: z.coerce.number().int().positive().optional(),
  bottle_count: z.coerce.number().int().min(0).optional(),
  voucher_count: z.coerce.number().int().min(0).optional(),
  is_premium: z.boolean().optional(),
});

export const adminVenueTableUpdateSchema = adminVenueTableSchema.partial();

export type AdminVenueLayoutInput = z.infer<typeof adminVenueLayoutSchema>;
export type AdminVenueZoneInput = z.infer<typeof adminVenueZoneSchema>;
export type AdminVenueTableInput = z.infer<typeof adminVenueTableSchema>;
