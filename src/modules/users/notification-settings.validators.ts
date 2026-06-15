import { z } from 'zod';

const channelMapSchema = z
  .object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
  })
  .optional();

export const updateNotificationSettingsSchema = z.object({
  master_enabled: z.boolean().optional(),
  channels: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
  types: z
    .object({
      purchases: channelMapSchema,
      reminders: channelMapSchema,
      promotions: channelMapSchema,
      social: channelMapSchema,
    })
    .optional(),
  night_silence: z
    .object({
      enabled: z.boolean().optional(),
      from_hour: z.number().int().min(0).max(23).nullable().optional(),
    })
    .optional(),
});

export const toggleNotificationsSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
