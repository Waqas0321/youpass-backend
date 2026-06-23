import { z } from 'zod';

export const listInvitationsQuerySchema = z.object({
  status: z.string().optional(),
  filter: z.enum(['active', 'pending', 'accepted', 'history']).optional(),
  tier: z.enum(['general', 'vip']).optional(),
  type: z
    .enum(['courtesy', 'free', 'general', 'vip', 'vip_table', 'discounted'])
    .optional(),
  product_kind: z
    .enum(['free', 'guaranteed_pass', 'discounted'])
    .optional(),
  search: z.string().max(200).optional(),
  event_type: z.string().trim().min(2).max(50).optional(),
  source: z.enum(['producer', 'guest']).optional(),
});

export const acceptInvitationSchema = z
  .object({
    biometric_confirmed: z.literal(true, {
      errorMap: () => ({
        message: 'Biometric confirmation is required before accepting',
      }),
    }),
    accept_charge_terms: z.boolean().optional(),
    payment_method_id: z.string().optional(),
  })
  .strict();

export const confirmInvitationSchema = z
  .object({
    biometric_confirmed: z.literal(true).optional(),
    accept_charge_terms: z.boolean().optional(),
    payment_method_id: z.string().optional(),
  })
  .optional()
  .default({});

export const cancelInvitationSchema = z
  .object({
    confirm: z.boolean().optional(),
  })
  .optional()
  .default({});

export const rejectInvitationSchema = z
  .object({
    reason: z.string().max(100).optional(),
  })
  .optional()
  .default({});

const tokenizedPaymentMethodSchema = z.object({
  payment_method_id: z.string().min(1),
  gateway: z.enum(['klap', 'stripe']),
  brand: z.string().min(2).max(30),
  last_four: z.string().regex(/^\d{4}$/),
  cardholder_name: z.string().min(2).max(200),
  expiration_month: z.coerce.number().int().min(1).max(12).optional(),
  expiration_year: z.coerce.number().int().min(2000).max(2100).optional(),
  set_as_default: z.boolean().optional(),
});

const legacyPaymentMethodSchema = z.object({
  card_number: z.string().min(13).max(19),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Use MM/YY format'),
  cvv: z.string().min(3).max(4),
  cardholder_name: z.string().min(2).max(200),
});

export const savePaymentMethodSchema = z.union([
  tokenizedPaymentMethodSchema,
  legacyPaymentMethodSchema,
]);

export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ConfirmInvitationInput = z.infer<typeof confirmInvitationSchema>;
export type SavePaymentMethodInput = z.infer<typeof savePaymentMethodSchema>;
export type TokenizedPaymentMethodInput = z.infer<typeof tokenizedPaymentMethodSchema>;
