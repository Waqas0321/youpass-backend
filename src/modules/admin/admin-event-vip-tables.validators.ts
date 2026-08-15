import { z } from 'zod';
import { adminVenueTableUpdateSchema } from './admin-venue-layout.validators.js';

export const adminVipTableActionSchema = z.object({
  action: z.enum(['reserve', 'release', 'block', 'unblock']),
});

export const adminVipTableMoveSchema = z.object({
  zone_id: z.string().min(1),
});

export const adminVipTableEditSchema = adminVenueTableUpdateSchema.pick({
  number: true,
  label: true,
  price: true,
  capacity: true,
  status: true,
});

export type AdminVipTableActionInput = z.infer<typeof adminVipTableActionSchema>;
export type AdminVipTableMoveInput = z.infer<typeof adminVipTableMoveSchema>;
export type AdminVipTableEditInput = z.infer<typeof adminVipTableEditSchema>;
