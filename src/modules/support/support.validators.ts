import { z } from 'zod';

const businessHoursSlotSchema = z
  .object({
    from: z.string().regex(/^\d{2}:\d{2}$/),
    to: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .nullable()
  .optional();

export const updateSupportConfigSchema = z.object({
  whatsapp_number: z.string().min(5).optional(),
  email: z.string().email().optional(),
  whatsapp_template_es: z.string().min(1).optional(),
  whatsapp_template_en: z.string().min(1).optional(),
  email_subject_es: z.string().min(1).optional(),
  email_subject_en: z.string().min(1).optional(),
  email_body_template_es: z.string().min(1).optional(),
  email_body_template_en: z.string().min(1).optional(),
  business_hours: z
    .object({
      timezone: z.string().min(1),
      weekdays: businessHoursSlotSchema,
      saturday: businessHoursSlotSchema,
      sunday: businessHoursSlotSchema,
    })
    .optional(),
  outside_hours_auto_reply_es: z.string().min(1).optional(),
  outside_hours_auto_reply_en: z.string().min(1).optional(),
  outside_hours_reply_within_hours: z.coerce.number().int().min(1).max(168).optional(),
});

export const createSupportFaqSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  question_es: z.string().min(1),
  question_en: z.string().min(1),
  answer_es: z.string().min(1),
  answer_en: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const updateSupportFaqSchema = createSupportFaqSchema
  .omit({ id: true })
  .partial();
