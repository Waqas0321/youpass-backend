import { z } from 'zod';

const checkoutItemSchema = z.object({
  offering_id: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
});

export const checkoutSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).optional(),
    tier: z.enum(['general', 'vip']).default('general'),
    type: z
      .enum(['courtesy', 'free', 'general', 'vip', 'vip_table', 'discounted'])
      .default('general'),
    payment_method_id: z.string().optional(),
    recaptcha_token: z.string().min(1).optional(),
    offering_id: z.string().optional(),
    items: z.array(checkoutItemSchema).optional(),
    table_id: z.string().optional(),
    zone_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasTable = Boolean(data.table_id);
    const hasItems = Boolean(data.items?.length);
    const hasOffering = Boolean(data.offering_id);
    const hasQuantity = Boolean(data.quantity);

    if (hasTable) return;

    if (!hasItems && !hasOffering && !hasQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide quantity, offering_id, items, or table_id',
        path: ['quantity'],
      });
    }
  });

export const assignTicketSlotSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_phone: z.string().trim().min(8).max(20),
  country_code: z.string().trim().length(2),
});

export const confirmCheckoutSchema = z.object({
  order_id: z.string().min(1),
  gateway: z.enum(['klap', 'stripe']).optional(),
  payment_intent_id: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ConfirmCheckoutInput = z.infer<typeof confirmCheckoutSchema>;
export type AssignTicketSlotInput = z.infer<typeof assignTicketSlotSchema>;
