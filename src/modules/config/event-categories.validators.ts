import { z } from 'zod';

const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens');

export const createEventCategorySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
  icon: z.string().max(16).optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

export const updateEventCategorySchema = z
  .object({
    slug: slugSchema.optional(),
    name: z.string().min(1).max(100).optional(),
    icon: z.string().max(16).nullable().optional(),
    display_order: z.coerce.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type CreateEventCategoryInput = z.infer<typeof createEventCategorySchema>;
export type UpdateEventCategoryInput = z.infer<typeof updateEventCategorySchema>;
