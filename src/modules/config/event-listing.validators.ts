import { z } from 'zod';

export const updateEventListingConfigSchema = z.object({
  date_weight: z.coerce.number().min(0).max(1).optional(),
  location_weight: z.coerce.number().min(0).max(1).optional(),
  featured_weight: z.coerce.number().min(0).max(1).optional(),
  page_size: z.coerce.number().int().min(1).max(50).optional(),
});

export type UpdateEventListingConfigInput = z.infer<typeof updateEventListingConfigSchema>;
