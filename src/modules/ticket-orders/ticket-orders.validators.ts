import { z } from 'zod';

export const checkoutSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(50),
  tier: z.enum(['general', 'vip']).default('general'),
  type: z
    .enum(['courtesy', 'free', 'general', 'vip', 'vip_table', 'discounted'])
    .default('general'),
  payment_method_id: z.string().optional(),
});

export const assignTicketSlotSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_phone: z.string().trim().min(8).max(20),
  country_code: z.string().trim().length(2),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AssignTicketSlotInput = z.infer<typeof assignTicketSlotSchema>;
