import { z } from 'zod';

const ticketOfferingTypeSchema = z.enum([
  'early_bird',
  'preventa_2',
  'preventa_3',
  'general',
  'vip_general',
]);

const ticketOfferingStatusSchema = z.enum(['active', 'sold_out', 'paused', 'closed']);

export const adminTicketOfferingSchema = z.object({
  type: ticketOfferingTypeSchema,
  name: z.string().min(1).max(120),
  price: z.coerce.number().positive(),
  stock_total: z.coerce.number().int().positive().optional().nullable(),
  stock_remaining: z.coerce.number().int().min(0).optional().nullable(),
  sale_start_at: z.string().datetime().optional().nullable(),
  sale_end_at: z.string().datetime().optional().nullable(),
  status: ticketOfferingStatusSchema.optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #8A2BE2')
    .optional()
    .nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  is_featured: z.boolean().optional(),
  max_per_user: z.coerce.number().int().positive().optional().nullable(),
});

export const adminTicketOfferingUpdateSchema = adminTicketOfferingSchema.partial();

export type AdminTicketOfferingInput = z.infer<typeof adminTicketOfferingSchema>;
export type AdminTicketOfferingUpdateInput = z.infer<typeof adminTicketOfferingUpdateSchema>;
