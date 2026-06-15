import { z } from 'zod';

export const listProducerInvitationsQuerySchema = z.object({
  event_id: z.string().optional(),
  type: z.enum(['free', 'guaranteed', 'discounted']).optional(),
  status: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const createProducerInvitationSchema = z
  .object({
    event_id: z.string().min(1),
    type: z.enum(['free', 'guaranteed', 'discounted']),
    recipient_user_id: z.string().min(1).optional(),
    recipient_phone: z.string().min(8).max(20).optional(),
    slot_label: z.string().min(1).max(120),
    cancellation_deadline_days: z.coerce.number().int().min(0).max(90).optional(),
    discount_percentage: z.coerce.number().int().min(1).max(99).optional(),
    personalised_message: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.recipient_user_id) !== Boolean(data.recipient_phone), {
    message: 'Provide exactly one of recipient_user_id or recipient_phone',
  });

export const reinviteProducerInvitationSchema = z.object({
  freed_slot_id: z.string().min(1),
  new_recipient_phone: z.string().min(8).max(20),
  personalised_message: z.string().max(500).optional(),
});

export const updateEventInvitationSettingsSchema = z.object({
  allow_free: z.boolean(),
  allow_guaranteed: z.boolean(),
  allow_discount: z.boolean(),
  free_cancellation_days: z.coerce.number().int().min(0).max(90),
  guaranteed_cancellation_days: z.coerce.number().int().min(0).max(90),
  discount_cancellation_days: z.coerce.number().int().min(0).max(90),
  discount_percentage: z
    .union([z.coerce.number().int().min(1).max(99), z.null()])
    .optional(),
  enable_waiting_list: z.boolean().optional(),
  enable_manual_reinvitation: z.boolean().optional(),
  waitlist_offer_hours: z.coerce.number().int().min(1).max(72).optional(),
  courtesy_slots_total: z.coerce.number().int().min(0).max(5000).optional(),
});

export const suggestedCandidatesQuerySchema = z.object({
  event_id: z.string().optional(),
  freed_slot_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const postEventReportQuerySchema = z.object({
  event_id: z.string().min(1),
  format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
});

export type ListProducerInvitationsQuery = z.infer<typeof listProducerInvitationsQuerySchema>;
export type CreateProducerInvitationInput = z.infer<typeof createProducerInvitationSchema>;
export type ReinviteProducerInvitationInput = z.infer<typeof reinviteProducerInvitationSchema>;
export type UpdateEventInvitationSettingsInput = z.infer<typeof updateEventInvitationSettingsSchema>;
