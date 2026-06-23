import { z } from 'zod';

const drinkProductStatusSchema = z.enum(['available', 'hidden', 'sold_out']);

export const adminEventDrinkCategorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/)
    .optional(),
  icon: z.string().max(8).optional().nullable(),
  display_order: z.coerce.number().int().min(0).optional(),
});

export const adminEventDrinkCategoryUpdateSchema = adminEventDrinkCategorySchema.partial();

export const adminEventDrinkProductSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  category_id: z.string().optional().nullable(),
  volume_ml: z.coerce.number().int().positive().optional().nullable(),
  price_clp: z.coerce.number().int().min(0),
  image_url: z.string().max(500).optional().nullable(),
  stock_total: z.coerce.number().int().min(0).optional().nullable(),
  stock_remaining: z.coerce.number().int().min(0).optional().nullable(),
  status: drinkProductStatusSchema.optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  is_recommended: z.boolean().optional(),
});

export const adminEventDrinkProductUpdateSchema = adminEventDrinkProductSchema.partial();

export type AdminEventDrinkCategoryInput = z.infer<typeof adminEventDrinkCategorySchema>;
export type AdminEventDrinkProductInput = z.infer<typeof adminEventDrinkProductSchema>;
