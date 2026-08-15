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

const sponsorSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  tone: z.string().min(4).max(32),
  logo_url: z.string().max(2000).optional(),
});

const socialLinkSchema = z.object({
  id: z.string().min(1).max(80),
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'other']),
  handle: z.string().min(1).max(200),
});

const optionalUrlSchema = z.string().max(2000).optional();

const eventBodyBaseSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  starts_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }),
  ends_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }).optional(),
  venue_id: z.string().min(1).optional(),
  venue_name: z.string().min(2).max(200).optional(),
  city: z.string().min(2).max(100).optional(),
  address_line: z.string().max(300).optional(),
  country_code: z.string().min(2).max(5).optional(),
  image_url: optionalUrlSchema,
  logo_url: optionalUrlSchema,
  teaser_video_url: optionalUrlSchema,
  carousel_images: z.array(z.string().max(2000)).max(20).optional(),
  floor_plan_image_url: optionalUrlSchema,
  min_age: z.number().int().min(0).max(99).optional(),
  dress_code: z.string().max(80).optional(),
  primary_color: z.string().max(32).optional(),
  secondary_color: z.string().max(32).optional(),
  sponsors: z.array(sponsorSchema).max(24).optional(),
  social_links: z.array(socialLinkSchema).max(24).optional(),
  event_type: z.string().min(1).max(50),
  is_featured: z.boolean().optional().default(false),
  featured_order: z.number().int().min(0).optional().default(0),
  status: z.enum(['draft', 'published', 'cancelled']).optional().default('draft'),
  producer_name: z.string().min(1).max(200).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const createEventSchema = eventBodyBaseSchema.superRefine((data, ctx) => {
  if (!data.venue_id && (!data.venue_name || !data.city || !data.country_code)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide venue_id or venue_name, city, and country_code',
    });
  }
});

export const updateEventSchema = eventBodyBaseSchema.partial().refine(
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
