import { z } from 'zod';

const venueDimensionsSchema = z.object({
  width_meters: z.coerce.number().positive(),
  height_meters: z.coerce.number().positive(),
});

export const createVenueSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(120),
  country: z.string().min(2).max(3).transform((v) => v.toUpperCase()),
  dimensions: venueDimensionsSchema,
});

export const updateVenueSchema = createVenueSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'At least one field is required' },
);

export const listVenuesQuerySchema = z.object({
  country: z.string().min(2).max(3).optional(),
  city: z.string().max(120).optional(),
  q: z.string().max(200).optional(),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
export type ListVenuesQuery = z.infer<typeof listVenuesQuerySchema>;
