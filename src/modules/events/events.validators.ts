import { z } from 'zod';

export const listEventsQuerySchema = z.object({
  country_code: z.string().min(2).max(5).optional(),
  event_type: z.string().min(1).max(50).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const featuredEventsQuerySchema = z.object({
  country_code: z.string().min(2).max(5).optional(),
  event_type: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const createEventSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  starts_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }),
  venue_name: z.string().min(2).max(200),
  city: z.string().min(2).max(100),
  country_code: z.string().min(2).max(5),
  image_url: z.string().url().max(2000).optional(),
  event_type: z.string().min(1).max(50),
  is_featured: z.boolean().optional().default(false),
  featured_order: z.number().int().min(0).optional().default(0),
  status: z.enum(['draft', 'published', 'cancelled']).optional().default('draft'),
});

export const updateEventSchema = createEventSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'At least one field is required' },
);

export const eventIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type FeaturedEventsQuery = z.infer<typeof featuredEventsQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
