import { z } from 'zod';

export const listInvitationsQuerySchema = z.object({
  status: z.string().optional(),
  tier: z.enum(['general', 'vip']).optional(),
  type: z
    .enum(['courtesy', 'free', 'general', 'vip', 'vip_table', 'discounted'])
    .optional(),
  search: z.string().max(200).optional(),
  source: z.enum(['producer', 'guest']).optional(),
});

export const confirmInvitationSchema = z
  .object({
    accept_charge_terms: z.boolean().optional(),
    payment_method_id: z.string().optional(),
  })
  .optional()
  .default({});

export const rejectInvitationSchema = z
  .object({
    reason: z.string().max(100).optional(),
  })
  .optional()
  .default({});

export const savePaymentMethodSchema = z.object({
  card_number: z.string().min(13).max(19),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Use MM/YY format'),
  cvv: z.string().min(3).max(4),
  cardholder_name: z.string().min(2).max(200),
});

export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
export type ConfirmInvitationInput = z.infer<typeof confirmInvitationSchema>;
export type SavePaymentMethodInput = z.infer<typeof savePaymentMethodSchema>;
