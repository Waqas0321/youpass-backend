import { z } from 'zod';

export const adminTicketOfferingSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  section: z.enum(['general', 'vip']),
  price: z.coerce.number().positive(),
  badge_label: z.string().max(80).optional().nullable(),
  display_order: z.coerce.number().int().min(0).optional(),
  stock_quantity: z.coerce.number().int().positive().optional().nullable(),
  sale_starts_at: z.string().datetime().optional().nullable(),
  sale_ends_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().optional(),
  maps_to_tier: z.enum(['general', 'vip']).optional(),
  maps_to_type: z.enum(['general', 'vip', 'vip_table', 'courtesy', 'free', 'discounted']).optional(),
});

export const adminTicketOfferingUpdateSchema = adminTicketOfferingSchema.partial();

export type AdminTicketOfferingInput = z.infer<typeof adminTicketOfferingSchema>;
export type AdminTicketOfferingUpdateInput = z.infer<typeof adminTicketOfferingUpdateSchema>;
