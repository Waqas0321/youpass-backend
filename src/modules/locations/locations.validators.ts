import { z } from 'zod';

export const locationSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  country_code: z
    .string()
    .trim()
    .length(2)
    .optional()
    .transform((value) => value?.toUpperCase()),
  limit: z.coerce.number().int().min(1).max(15).optional().default(8),
});

export type LocationSearchQuery = z.infer<typeof locationSearchQuerySchema>;
