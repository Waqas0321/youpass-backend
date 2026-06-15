import type { Event, EventType, Prisma, UserCategory } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { HOME_BANNER_CAROUSEL } from '../../common/constants/home-banner.constants.js';
import type { CreateHomeBannerInput, UpdateHomeBannerInput } from './home-banners.validators.js';
import {
  formatAdminHomeBanner,
  formatCarouselConfig,
  formatFeaturedEventFallbackSlide,
  formatHomeBannerSlide,
  formatMainBannerPayload,
  type ResolveCarouselContext,
} from './home-banners.formatter.js';

const bannerInclude = {
  event: { include: { eventType: true } },
  producer: true,
} as const;

function normalizeCountryCodes(codes: string[] | undefined) {
  return (codes ?? []).map((code) => code.toUpperCase());
}

function matchesSegmentation(
  slide: {
    countryCodes: string[];
    cities: string[];
    userCategories: UserCategory[];
  },
  context: ResolveCarouselContext,
) {
  if (slide.countryCodes.length > 0) {
    const country = context.countryCode?.toUpperCase();
    if (!country || !slide.countryCodes.includes(country)) {
      return false;
    }
  }

  if (slide.cities.length > 0) {
    const city = context.city?.trim().toLowerCase();
    if (!city) {
      return false;
    }
    const matchesCity = slide.cities.some((value) => value.trim().toLowerCase() === city);
    if (!matchesCity) {
      return false;
    }
  }

  if (slide.userCategories.length > 0) {
    if (!context.userCategory || !slide.userCategories.includes(context.userCategory)) {
      return false;
    }
  }

  return true;
}

async function getFavoriteIds(userId?: string) {
  if (!userId) {
    return new Set<string>();
  }

  const favorites = await prisma.eventFavorite.findMany({
    where: { userId },
    select: { eventId: true },
  });

  return new Set(favorites.map((favorite) => favorite.eventId));
}

async function resolveEventTypeId(eventType?: string) {
  if (!eventType) {
    return undefined;
  }

  const type = await prisma.eventType.findFirst({
    where: { slug: eventType.toLowerCase(), isActive: true },
    select: { id: true },
  });

  return type?.id;
}

async function validateTapActionReferences(input: {
  tap_action_type: CreateHomeBannerInput['tap_action_type'];
  event_id?: string;
  producer_id?: string;
}) {
  if (input.tap_action_type === 'event_detail' && input.event_id) {
    const event = await prisma.event.findUnique({ where: { id: input.event_id } });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Linked event not found');
    }
  }

  if (input.tap_action_type === 'promoter_page' && input.producer_id) {
    const producer = await prisma.producer.findUnique({ where: { id: input.producer_id } });
    if (!producer) {
      throw new AppError(404, 'PRODUCER_NOT_FOUND', 'Linked producer not found');
    }
  }
}

function mapCreateData(input: CreateHomeBannerInput): Prisma.HomeBannerSlideCreateInput {
  return {
    title: input.title ?? null,
    subtitle: input.subtitle ?? null,
    imageUrl: input.image_url,
    tapActionType: input.tap_action_type,
    externalUrl: input.external_url ?? null,
    landingSlug: input.landing_slug ?? null,
    displayStartsAt: new Date(input.display_starts_at),
    displayEndsAt: new Date(input.display_ends_at),
    countryCodes: normalizeCountryCodes(input.country_codes),
    cities: input.cities ?? [],
    userCategories: input.user_categories ?? [],
    priority: input.priority ?? 0,
    aspectRatio: input.aspect_ratio ?? '16:9',
    isActive: true,
    ...(input.event_id ? { event: { connect: { id: input.event_id } } } : {}),
    ...(input.producer_id ? { producer: { connect: { id: input.producer_id } } } : {}),
  };
}

export const homeBannersService = {
  getCarouselConfig() {
    return formatCarouselConfig();
  },

  async listAll() {
    const slides = await prisma.homeBannerSlide.findMany({
      include: bannerInclude,
      orderBy: [{ priority: 'asc' }, { displayStartsAt: 'asc' }],
    });
    return slides.map(formatAdminHomeBanner);
  },

  async create(input: CreateHomeBannerInput) {
    await validateTapActionReferences(input);
    const slide = await prisma.homeBannerSlide.create({
      data: mapCreateData(input),
      include: bannerInclude,
    });
    return formatAdminHomeBanner(slide);
  },

  async update(id: string, input: UpdateHomeBannerInput) {
    const current = await prisma.homeBannerSlide.findUnique({ where: { id } });
    if (!current) {
      throw new AppError(404, 'BANNER_NOT_FOUND', 'Home banner slide not found');
    }

    const nextTapActionType = input.tap_action_type ?? current.tapActionType;
    await validateTapActionReferences({
      tap_action_type: nextTapActionType,
      event_id: input.event_id ?? current.eventId ?? undefined,
      producer_id: input.producer_id ?? current.producerId ?? undefined,
    });

    const slide = await prisma.homeBannerSlide.update({
      where: { id },
      data: {
        title: input.title === undefined ? undefined : input.title,
        subtitle: input.subtitle === undefined ? undefined : input.subtitle,
        imageUrl: input.image_url,
        tapActionType: input.tap_action_type,
        externalUrl: input.external_url === undefined ? undefined : input.external_url,
        landingSlug: input.landing_slug === undefined ? undefined : input.landing_slug,
        displayStartsAt: input.display_starts_at ? new Date(input.display_starts_at) : undefined,
        displayEndsAt: input.display_ends_at ? new Date(input.display_ends_at) : undefined,
        countryCodes:
          input.country_codes === undefined ? undefined : normalizeCountryCodes(input.country_codes),
        cities: input.cities,
        userCategories: input.user_categories,
        priority: input.priority,
        aspectRatio: input.aspect_ratio,
        isActive: input.is_active,
        ...(input.event_id === undefined
          ? {}
          : input.event_id
            ? { event: { connect: { id: input.event_id } } }
            : { event: { disconnect: true } }),
        ...(input.producer_id === undefined
          ? {}
          : input.producer_id
            ? { producer: { connect: { id: input.producer_id } } }
            : { producer: { disconnect: true } }),
      },
      include: bannerInclude,
    });

    return formatAdminHomeBanner(slide);
  },

  async remove(id: string) {
    const current = await prisma.homeBannerSlide.findUnique({ where: { id } });
    if (!current) {
      throw new AppError(404, 'BANNER_NOT_FOUND', 'Home banner slide not found');
    }

    await prisma.homeBannerSlide.delete({ where: { id } });
    return { id, deleted: true };
  },

  async listMatchingSlides(context: ResolveCarouselContext) {
    const now = new Date();
    const slides = await prisma.homeBannerSlide.findMany({
      where: {
        isActive: true,
        displayStartsAt: { lte: now },
        displayEndsAt: { gte: now },
      },
      include: bannerInclude,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: HOME_BANNER_CAROUSEL.max_slides,
    });

    return slides.filter((slide) => matchesSegmentation(slide, context));
  },

  async getFeaturedEventFallbackSlides(
    context: ResolveCarouselContext,
    options: { take: number; excludeIds?: string[] },
  ) {
    if (options.take <= 0) {
      return [];
    }

    const eventTypeId = await resolveEventTypeId(context.eventType);
    const favoriteIds = await getFavoriteIds(context.userId);
    const excludeIds = new Set([
      ...(context.excludeEventIds ?? []),
      ...(options.excludeIds ?? []),
    ]);

    const events = await prisma.event.findMany({
      where: {
        status: 'published',
        startsAt: { gte: new Date() },
        ...(context.countryCode ? { countryCode: context.countryCode.toUpperCase() } : {}),
        ...(eventTypeId ? { eventTypeId } : {}),
        ...(excludeIds.size ? { id: { notIn: [...excludeIds] } } : {}),
      },
      include: { eventType: true },
      orderBy: [{ isFeatured: 'desc' }, { featuredOrder: 'asc' }, { startsAt: 'asc' }],
      take: options.take,
    });

    return events.map((event) =>
      formatFeaturedEventFallbackSlide(event as Event & { eventType: EventType }, favoriteIds.has(event.id)),
    );
  },

  async resolveCarousel(context: ResolveCarouselContext) {
    const favoriteIds = await getFavoriteIds(context.userId);
    const curatedSlides = await this.listMatchingSlides(context);
    const slides: Array<ReturnType<typeof formatHomeBannerSlide> | ReturnType<typeof formatFeaturedEventFallbackSlide>> =
      curatedSlides.map((slide) =>
      formatHomeBannerSlide(slide, {
        isFavorite: slide.eventId ? favoriteIds.has(slide.eventId) : false,
      }),
    );

    const linkedEventIds = slides
      .map((slide) => slide.tap_action.event_id)
      .filter((value): value is string => Boolean(value));

    if (slides.length < HOME_BANNER_CAROUSEL.min_slides) {
      const fallbackSlides = await this.getFeaturedEventFallbackSlides(context, {
        take: HOME_BANNER_CAROUSEL.max_slides - slides.length,
        excludeIds: [...linkedEventIds, ...(context.excludeEventIds ?? [])],
      });

      const existingIds = new Set(
        slides.map((slide) => slide.tap_action.event_id ?? slide.banner_id).filter(Boolean),
      );

      for (const fallback of fallbackSlides) {
        const key = fallback.tap_action.event_id ?? fallback.id;
        if (existingIds.has(key)) {
          continue;
        }
        slides.push(fallback);
        existingIds.add(key);
        if (slides.length >= HOME_BANNER_CAROUSEL.max_slides) {
          break;
        }
      }
    }

    const trimmedSlides: Array<ReturnType<typeof formatHomeBannerSlide> | ReturnType<typeof formatFeaturedEventFallbackSlide>> =
      slides.slice(0, HOME_BANNER_CAROUSEL.max_slides);
    return {
      slides: trimmedSlides,
      main_banner: formatMainBannerPayload(trimmedSlides),
      carousel_config: formatCarouselConfig(),
    };
  },
};
