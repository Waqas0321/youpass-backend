import { z } from 'zod';

export const createDrinkOrderSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30),
  /** Saved card id (or provider token). Defaults to the user's default card. */
  payment_method_id: z.string().trim().min(1).max(200).optional(),
});

export type CreateDrinkOrderInput = z.infer<typeof createDrinkOrderSchema>;
