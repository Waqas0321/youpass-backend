import { z } from 'zod';

const datePresetSchema = z.enum(['today', 'this_week', 'this_weekend', 'this_month', 'custom']);
const venueKindSchema = z.enum([
  'stadium',
  'club_nightclub',
  'theatre',
  'open_air',
  'events_centre',
  'bar_restaurant',
  'other',
]);

export const listEventsQuerySchema = z.object({
  country_code: z.string().min(2).max(5).optional(),
  event_type: z.string().min(1).max(50).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().trim().min(1).max(200).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  zone: z.string().trim().min(2).max(100).optional(),
  date_preset: datePresetSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  venue_kind: venueKindSchema.optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  free_only: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  near_me: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const upcomingEventsQuerySchema = z.object({
  country_code: z.string().min(2).max(5).optional(),
  event_type: z.string().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  near_me: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  exclude_ids: z.string().trim().optional(),
});

export const homeFeedQuerySchema = z.object({
  country_code: z.string().min(2).max(5).optional(),
  country: z.string().min(2).max(5).optional(),
  city: z.string().min(2).max(100).optional(),
  event_type: z.string().min(1).max(50).optional(),
  context: z.string().optional(),
  upcoming_page: z.coerce.number().int().min(1).default(1),
  upcoming_limit: z.coerce.number().int().min(1).max(50).default(20),
  near_me: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const featuredEventsQuerySchema = z.object({
  country_code: z.string().min(2).max(5).optional(),
  city: z.string().min(2).max(100).optional(),
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
  producer_name: z.string().min(1).max(200).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const updateEventSchema = createEventSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'At least one field is required' },
);

export const eventIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type UpcomingEventsQuery = z.infer<typeof upcomingEventsQuerySchema>;
export type HomeFeedQuery = z.infer<typeof homeFeedQuerySchema>;
export type FeaturedEventsQuery = z.infer<typeof featuredEventsQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
