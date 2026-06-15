import { z } from 'zod';

const aspectRatioSchema = z.enum(['16:9', '21:9']);
const tapActionTypeSchema = z.enum(['event_detail', 'external_url', 'promoter_page', 'landing_page']);
const userCategorySchema = z.enum(['bronze', 'silver', 'gold']);

const bannerFieldsSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  image_url: z.string().url().max(2000),
  tap_action_type: tapActionTypeSchema.default('event_detail'),
  event_id: z.string().min(1).optional(),
  external_url: z.string().url().max(2000).optional(),
  producer_id: z.string().min(1).optional(),
  landing_slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  display_starts_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }),
  display_ends_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }),
  country_codes: z.array(z.string().min(2).max(5)).default([]),
  cities: z.array(z.string().min(2).max(100)).default([]),
  user_categories: z.array(userCategorySchema).default([]),
  priority: z.coerce.number().int().min(0).default(0),
  aspect_ratio: aspectRatioSchema.default('16:9'),
  is_active: z.boolean().optional(),
});

function validateTapAction(
  data: {
    tap_action_type: z.infer<typeof tapActionTypeSchema>;
    event_id?: string;
    external_url?: string;
    producer_id?: string;
    landing_slug?: string;
  },
  ctx: z.RefinementCtx,
) {
  switch (data.tap_action_type) {
    case 'event_detail':
      if (!data.event_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'event_id is required for event_detail tap action',
          path: ['event_id'],
        });
      }
      break;
    case 'external_url':
      if (!data.external_url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'external_url is required for external_url tap action',
          path: ['external_url'],
        });
      }
      break;
    case 'promoter_page':
      if (!data.producer_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'producer_id is required for promoter_page tap action',
          path: ['producer_id'],
        });
      }
      break;
    case 'landing_page':
      if (!data.landing_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'landing_slug is required for landing_page tap action',
          path: ['landing_slug'],
        });
      }
      break;
    default:
      break;
  }
}

function validateDisplayWindow(
  data: { display_starts_at: string; display_ends_at: string },
  ctx: z.RefinementCtx,
) {
  const startsAt = new Date(data.display_starts_at);
  const endsAt = new Date(data.display_ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return;
  }
  if (endsAt <= startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'display_ends_at must be after display_starts_at',
      path: ['display_ends_at'],
    });
  }
}

export const createHomeBannerSchema = bannerFieldsSchema.superRefine((data, ctx) => {
  validateTapAction(data, ctx);
  validateDisplayWindow(data, ctx);
});

export const updateHomeBannerSchema = bannerFieldsSchema
  .partial()
  .extend({
    image_url: z.string().url().max(2000).optional(),
    display_starts_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }).optional(),
    display_ends_at: z.string().datetime({ message: 'Use ISO 8601 datetime' }).optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
      });
      return;
    }
    if (data.tap_action_type) {
      validateTapAction(
        {
          tap_action_type: data.tap_action_type,
          event_id: data.event_id,
          external_url: data.external_url,
          producer_id: data.producer_id,
          landing_slug: data.landing_slug,
        },
        ctx,
      );
    }
    if (data.display_starts_at && data.display_ends_at) {
      validateDisplayWindow(
        {
          display_starts_at: data.display_starts_at,
          display_ends_at: data.display_ends_at,
        },
        ctx,
      );
    }
  });

export type CreateHomeBannerInput = z.infer<typeof createHomeBannerSchema>;
export type UpdateHomeBannerInput = z.infer<typeof updateHomeBannerSchema>;
