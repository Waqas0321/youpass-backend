import { HOME_BANNER_CAROUSEL } from '../../common/constants/home-banner.constants.js';
import type { Event, EventType, HomeBannerSlide, Producer, UserCategory } from '@prisma/client';
import { formatBannerSlide } from '../events/events.formatter.js';
import { getCountrySync } from '../../common/services/country-config.service.js';

type BannerWithRelations = HomeBannerSlide & {
  event?: (Event & { eventType: EventType }) | null;
  producer?: Producer | null;
};

export function formatBannerTapAction(slide: HomeBannerSlide) {
  return {
    type: slide.tapActionType,
    event_id: slide.eventId,
    url: slide.externalUrl,
    producer_id: slide.producerId,
    landing_slug: slide.landingSlug,
  };
}

export function formatHomeBannerSlide(
  slide: BannerWithRelations,
  options?: { isFavorite?: boolean },
) {
  const tapAction = formatBannerTapAction(slide);
  const eventSlide =
    slide.event && slide.tapActionType === 'event_detail'
      ? formatBannerSlide(slide.event, options?.isFavorite ?? false, {
          timezone: getCountrySync(slide.event.countryCode)?.timezone,
          languageCode: getCountrySync(slide.event.countryCode)?.languageCode,
        })
      : null;

  return {
    id: slide.eventId ?? slide.id,
    banner_id: slide.id,
    title: slide.title ?? eventSlide?.title ?? null,
    subtitle: slide.subtitle ?? null,
    image_url: slide.imageUrl,
    aspect_ratio: slide.aspectRatio,
    tap_action: tapAction,
    source: 'editorial',
    date_display: eventSlide?.date_display ?? null,
    date_time_display: eventSlide?.date_time_display ?? null,
    location_display: eventSlide?.location_display ?? null,
    event_type: eventSlide?.event_type ?? null,
    is_favorite: eventSlide?.is_favorite ?? false,
  };
}

export function formatFeaturedEventFallbackSlide(
  event: Event & { eventType: EventType },
  isFavorite = false,
) {
  const country = getCountrySync(event.countryCode);
  const slide = formatBannerSlide(event, isFavorite, {
    timezone: country?.timezone,
    languageCode: country?.languageCode,
  });

  return {
    ...slide,
    banner_id: null,
    subtitle: null,
    aspect_ratio: '16:9',
    tap_action: {
      type: 'event_detail' as const,
      event_id: event.id,
      url: null,
      producer_id: null,
      landing_slug: null,
    },
    source: 'featured_event_fallback',
  };
}

export function formatAdminHomeBanner(slide: BannerWithRelations) {
  return {
    id: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    image_url: slide.imageUrl,
    tap_action_type: slide.tapActionType,
    event_id: slide.eventId,
    external_url: slide.externalUrl,
    producer_id: slide.producerId,
    landing_slug: slide.landingSlug,
    display_starts_at: slide.displayStartsAt.toISOString(),
    display_ends_at: slide.displayEndsAt.toISOString(),
    country_codes: slide.countryCodes,
    cities: slide.cities,
    user_categories: slide.userCategories,
    priority: slide.priority,
    aspect_ratio: slide.aspectRatio,
    is_active: slide.isActive,
    event: slide.event
      ? {
          id: slide.event.id,
          title: slide.event.title,
          city: slide.event.city,
          country_code: slide.event.countryCode,
        }
      : null,
    producer: slide.producer
      ? {
          id: slide.producer.id,
          name: slide.producer.name,
        }
      : null,
    created_at: slide.createdAt.toISOString(),
    updated_at: slide.updatedAt.toISOString(),
  };
}

export function formatCarouselConfig() {
  return {
    min_slides: HOME_BANNER_CAROUSEL.min_slides,
    max_slides: HOME_BANNER_CAROUSEL.max_slides,
    autoplay_interval_ms: HOME_BANNER_CAROUSEL.autoplay_interval_ms,
    aspect_ratio: HOME_BANNER_CAROUSEL.aspect_ratio,
    aspect_ratio_alternate: HOME_BANNER_CAROUSEL.aspect_ratio_alternate,
    height_screen_fraction_min: HOME_BANNER_CAROUSEL.height_screen_fraction_min,
    height_screen_fraction_max: HOME_BANNER_CAROUSEL.height_screen_fraction_max,
  };
}

export function formatMainBannerPayload(
  slides: Array<ReturnType<typeof formatHomeBannerSlide> | ReturnType<typeof formatFeaturedEventFallbackSlide>>,
) {
  return {
    curated_by: HOME_BANNER_CAROUSEL.curated_by,
    title: HOME_BANNER_CAROUSEL.title,
    slides,
    indicators: {
      total: slides.length,
      active_index: 0,
    },
    carousel: formatCarouselConfig(),
  };
}

export type ResolveCarouselContext = {
  countryCode?: string;
  city?: string;
  userCategory?: UserCategory;
  userId?: string;
  eventType?: string;
  excludeEventIds?: string[];
};
