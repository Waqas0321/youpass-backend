import { z } from 'zod';

export const setEventSalesPausedSchema = z.object({
  sales_paused: z.boolean(),
});

export type SetEventSalesPausedInput = z.infer<typeof setEventSalesPausedSchema>;
