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
});

export type CreateDrinkOrderInput = z.infer<typeof createDrinkOrderSchema>;
