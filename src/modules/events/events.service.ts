import type { Event, EventType, Prisma } from '@prisma/client';
import { invitationSettingsService } from '../invitations/invitation-settings.service.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatEvent, formatEventDetailSchedule, formatEventType, formatEventProducerBlock, formatUpcomingEventCard } from './events.formatter.js';
import {
  buildListingProximityMeta,
  eventListingConfigService,
  paginateSortedEvents,
  sortEventsForListing,
} from '../../common/services/event-listing-sort.service.js';
import type { GeoPoint } from '../../common/utils/geo-distance.js';
import { homeBannersService } from '../config/home-banners.service.js';
import type {
  CreateEventInput,
  FeaturedEventsQuery,
  ListEventsQuery,
  UpdateEventInput,
} from './events.validators.js';
import { vipVenueService } from '../vip-venue/vip-venue.service.js';
import { producerFollowNotificationsService } from '../producers/producer-follow-notifications.service.js';
import { waitlistService } from '../waitlist/waitlist.service.js';
import { getCountrySync, getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { resolveDateRange } from '../../common/utils/event-date-range.js';
import { buildVenueKindWhere } from '../../common/utils/venue-kind-filter.js';
import { venuesService } from '../venues/venues.service.js';

const eventInclude = { eventType: true, venue: true } as const;

type EventWithType = Event & { eventType: EventType; venue?: import('@prisma/client').Venue | null };

async function resolveEventVenueFields(input: {
  venue_id?: string;
  venue_name?: string;
  city?: string;
  country_code?: string;
}) {
  if (input.venue_id) {
    const venue = await venuesService.resolveForLink(input.venue_id);
    return {
      venueId: venue.id,
      venueName: input.venue_name?.trim() ?? venue.name,
      city: input.city?.trim() ?? venue.city,
      countryCode: input.country_code?.toUpperCase() ?? venue.country,
    };
  }

  if (!input.venue_name || !input.city || !input.country_code) {
    throw new AppError(
      400,
      'INVALID_VENUE',
      'Provide venue_id or venue_name, city, and country_code',
    );
  }

  return {
    venueId: null as string | null,
    venueName: input.venue_name.trim(),
    city: input.city.trim(),
    countryCode: input.country_code.toUpperCase(),
  };
}

async function resolveEventType(slug: string): Promise<EventType> {
  const eventType = await prisma.eventType.findFirst({
    where: { slug: slug.toLowerCase(), isActive: true },
  });

  if (!eventType) {
    throw new AppError(400, 'INVALID_EVENT_TYPE', 'Event type not found');
  }

  return eventType;
}

async function getFavoriteIds(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();

  const favorites = await prisma.eventFavorite.findMany({
    where: { userId },
    select: { eventId: true },
  });

  return new Set(favorites.map((f) => f.eventId));
}

function buildPublishedWhere(
  query: {
    country_code?: string;
    event_type?: string;
    featured?: boolean;
    search?: string;
    city?: string;
    zone?: string;
    date_preset?: 'today' | 'this_week' | 'this_weekend' | 'this_month' | 'custom';
    date_from?: string;
    date_to?: string;
    venue_kind?: string;
    min_price?: number;
    max_price?: number;
    free_only?: boolean;
    exclude_ids?: string[];
  },
  eventTypeId?: string,
): Prisma.EventWhereInput {
  const searchTerm = query.search?.trim();
  const timezone = query.country_code
    ? (getCountrySync(query.country_code)?.timezone ?? 'UTC')
    : 'UTC';
  const dateRange = resolveDateRange({
    date_preset: query.date_preset === 'custom' ? undefined : query.date_preset,
    date_from: query.date_from,
    date_to: query.date_to,
    timezone,
  });

  const startsAtFilter: Prisma.DateTimeFilter = { gte: new Date() };
  if (dateRange?.gte) startsAtFilter.gte = dateRange.gte;
  if (dateRange?.lte) startsAtFilter.lte = dateRange.lte;

  const priceFilters: Prisma.EventWhereInput[] = [];
  if (query.free_only) {
    priceFilters.push({ OR: [{ minPrice: 0 }, { minPrice: null }] });
  } else {
    if (query.min_price !== undefined) {
      priceFilters.push({ OR: [{ minPrice: { gte: query.min_price } }, { minPrice: null }] });
    }
    if (query.max_price !== undefined) {
      priceFilters.push({ OR: [{ minPrice: { lte: query.max_price } }, { minPrice: null }] });
    }
  }

  return {
    status: 'published',
    startsAt: startsAtFilter,
    ...(query.country_code ? { countryCode: query.country_code.toUpperCase() } : {}),
    ...(eventTypeId ? { eventTypeId } : {}),
    ...(query.featured === true ? { isFeatured: true } : {}),
    ...(query.exclude_ids?.length ? { id: { notIn: query.exclude_ids } } : {}),
    ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
    ...(query.zone ? { zone: { equals: query.zone, mode: 'insensitive' } } : {}),
    ...(query.venue_kind ? buildVenueKindWhere(query.venue_kind) : {}),
    ...(priceFilters.length ? { AND: priceFilters } : {}),
    ...(searchTerm
      ? {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { venueName: { contains: searchTerm, mode: 'insensitive' } },
            { city: { contains: searchTerm, mode: 'insensitive' } },
            { zone: { contains: searchTerm, mode: 'insensitive' } },
            { producerName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}


function mapEvents(events: EventWithType[], favoriteIds: Set<string>) {
  return events.map((event) => {
    const country = getCountrySync(event.countryCode);
    return formatEvent(event, favoriteIds.has(event.id), {
      timezone: country?.timezone,
      languageCode: country?.languageCode,
    });
  });
}

export const eventsService = {
  async listEventTypes() {
    const types = await prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return types.map(formatEventType);
  },

  async listEvents(query: ListEventsQuery, userId?: string) {
    const eventType = query.event_type ? await resolveEventType(query.event_type) : undefined;
    const favoriteIds = await getFavoriteIds(userId);
    const search = query.q ?? query.search;
    const where = buildPublishedWhere({ ...query, search }, eventType?.id);

    const skip = (query.page - 1) * query.limit;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: [{ isFeatured: 'desc' }, { featuredOrder: 'asc' }, { startsAt: 'asc' }],
        skip,
        take: query.limit,
      }),
      prisma.event.count({ where }),
    ]);

    return {
      events: mapEvents(events, favoriteIds),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  async getFeaturedEvents(query: FeaturedEventsQuery, userId?: string) {
    const eventType = query.event_type ? await resolveEventType(query.event_type) : undefined;
    const favoriteIds = await getFavoriteIds(userId);
    const where = buildPublishedWhere({ ...query, featured: true }, eventType?.id);

    const events = await prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: [{ featuredOrder: 'asc' }, { startsAt: 'asc' }],
      take: query.limit,
    });

    const formatted = mapEvents(events, favoriteIds);
    const bannerResult = await homeBannersService.resolveCarousel({
      countryCode: query.country_code,
      city: query.city,
      userId,
      eventType: query.event_type,
    });

    return {
      carousel: bannerResult.slides,
      events: formatted,
      slides: bannerResult.slides,
      main_banner: bannerResult.main_banner,
      carousel_config: bannerResult.carousel_config,
    };
  },

  async listUpcomingEvents(
    query: {
      country_code?: string;
      event_type?: string;
      page?: number;
      limit?: number;
      exclude_ids?: string[];
      near_me?: boolean;
      lat?: number;
      lng?: number;
    },
    userId?: string,
  ) {
    const weights = await eventListingConfigService.getWeights();
    const page = query.page ?? 1;
    const limit = query.limit ?? weights.pageSize;
    const skip = (page - 1) * limit;
    const eventType = query.event_type ? await resolveEventType(query.event_type) : undefined;
    const userLocation: GeoPoint | null =
      query.lat != null && query.lng != null
        ? { latitude: query.lat, longitude: query.lng }
        : null;
    const favoriteIds = await getFavoriteIds(userId);

    const buildWhere = (excludeIds?: string[]) =>
      buildPublishedWhere(
        {
          country_code: query.country_code,
          event_type: query.event_type,
          exclude_ids: excludeIds,
        },
        eventType?.id,
      );

    const mapPageItems = async (pageItems: EventWithType[], total: number) => {
      const waitlistMeta = userId
        ? await waitlistService.getWaitlistListingMetaForUser(
            pageItems.map((event) => event.id),
            userId,
          )
        : null;

      const items = pageItems.map((event) => {
        const country = getCountrySync(event.countryCode);
        const proximity = buildListingProximityMeta(event, userLocation);
        return formatUpcomingEventCard(event, favoriteIds.has(event.id), {
          timezone: country?.timezone,
          languageCode: country?.languageCode,
          distance_km: proximity.distance_km,
          travel_time_minutes: proximity.travel_time_minutes,
          waitlist: waitlistMeta?.get(event.id) ?? null,
        });
      });

      const totalPages = Math.ceil(total / limit) || 1;

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_more: page < totalPages,
        },
        sort_weights: eventListingConfigService.formatWeights(weights),
      };
    };

    if (query.near_me === true && userLocation != null) {
      const NEAR_ME_CANDIDATE_LIMIT = 250;
      let where = buildWhere(query.exclude_ids);
      let events = await prisma.event.findMany({
        where: {
          ...where,
          latitude: { not: null },
          longitude: { not: null },
        },
        include: eventInclude,
        orderBy: { startsAt: 'asc' },
        take: NEAR_ME_CANDIDATE_LIMIT,
      });

      if (events.length === 0 && query.exclude_ids?.length) {
        where = buildWhere();
        events = await prisma.event.findMany({
          where: {
            ...where,
            latitude: { not: null },
            longitude: { not: null },
          },
          include: eventInclude,
          orderBy: { startsAt: 'asc' },
          take: NEAR_ME_CANDIDATE_LIMIT,
        });
      }

      const sorted = sortEventsForListing(events, weights, {
        userLocation,
        nearMe: true,
      });
      const pageItems = paginateSortedEvents(sorted, page, limit);
      return mapPageItems(pageItems, sorted.length);
    }

    let where = buildWhere(query.exclude_ids);
    const fetchPage = async (activeWhere: Prisma.EventWhereInput) => {
      const [events, total] = await Promise.all([
        prisma.event.findMany({
          where: activeWhere,
          include: eventInclude,
          orderBy: [{ isFeatured: 'desc' }, { startsAt: 'asc' }],
          skip,
          take: limit,
        }),
        prisma.event.count({ where: activeWhere }),
      ]);
      return { events, total };
    };

    let { events, total } = await fetchPage(where);
    if (events.length === 0 && page === 1 && query.exclude_ids?.length) {
      where = buildWhere();
      ({ events, total } = await fetchPage(where));
    }

    return mapPageItems(events, total);
  },

  async getEventById(id: string, userId?: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });

    if (!event || event.status === 'cancelled') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const favoriteIds = await getFavoriteIds(userId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);
    const purchase = await vipVenueService.getPurchaseMeta(id).catch(() => ({
      service_fee_rate: 0.05,
      ...currencyMeta,
      has_ticket_offerings: false,
      has_venue_layout: false,
    }));

    const country = getCountrySync(event.countryCode);
    const waitlist =
      userId != null
        ? await waitlistService.formatUserWaitlistStatus(id, userId)
        : {
            enabled: false,
            joinable: await waitlistService.isCourtesySlotsFull(id),
            status: null,
            position: null,
            offer_id: null,
            offer_expires_at: null,
            can_join: false,
            can_leave: false,
            offer_hours: 4,
          };

    let producer = null;
    if (event.producerName?.trim()) {
      producer = await prisma.producer.findFirst({
        where: { name: event.producerName.trim() },
      });
    }

    const isFollowingProducer =
      producer && userId
        ? !!(await prisma.producerFollow.findUnique({
            where: { userId_producerId: { userId, producerId: producer.id } },
          }))
        : false;

    const timezone = country?.timezone;
    const languageCode = country?.languageCode;

    return {
      ...formatEvent(event, favoriteIds.has(event.id), {
        timezone,
        languageCode,
      }),
      schedule_display: formatEventDetailSchedule(event.startsAt, timezone, languageCode),
      producer: producer
        ? formatEventProducerBlock(producer, isFollowingProducer)
        : null,
      purchase,
      waitlist,
    };
  },

  async createEvent(input: CreateEventInput) {
    const eventType = await resolveEventType(input.event_type);
    const venueFields = await resolveEventVenueFields(input);

    const country = await prisma.country.findFirst({
      where: { code: venueFields.countryCode, isActive: true },
    });

    if (!country) {
      throw new AppError(400, 'INVALID_COUNTRY', 'Country not supported');
    }

    const event = await prisma.event.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim(),
        startsAt: new Date(input.starts_at),
        venueId: venueFields.venueId,
        venueName: venueFields.venueName,
        city: venueFields.city,
        countryCode: country.code,
        imageUrl: input.image_url,
        eventTypeId: eventType.id,
        isFeatured: input.is_featured ?? false,
        featuredOrder: input.featured_order ?? 0,
        status: input.status ?? 'draft',
        producerName: input.producer_name?.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
      },
      include: eventInclude,
    });

    await invitationSettingsService.ensureInvitationSettings(event.id);

    return formatEvent(event, false);
  },

  async updateEvent(id: string, input: UpdateEventInput) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    let eventTypeId: string | undefined;
    if (input.event_type !== undefined) {
      eventTypeId = (await resolveEventType(input.event_type)).id;
    }

    let countryCode: string | undefined;
    let venueId: string | null | undefined;
    let venueName: string | undefined;
    let city: string | undefined;

    if (input.venue_id !== undefined) {
      const venueFields = await resolveEventVenueFields({
        venue_id: input.venue_id,
        venue_name: input.venue_name,
        city: input.city,
        country_code: input.country_code,
      });
      venueId = venueFields.venueId;
      venueName = venueFields.venueName;
      city = venueFields.city;
      countryCode = venueFields.countryCode;
    } else if (input.venue_name !== undefined || input.city !== undefined || input.country_code !== undefined) {
      venueName = input.venue_name?.trim() ?? existing.venueName;
      city = input.city?.trim() ?? existing.city;
      countryCode = input.country_code?.toUpperCase() ?? existing.countryCode;
    }

    if (countryCode !== undefined) {
      const country = await prisma.country.findFirst({
        where: { code: countryCode, isActive: true },
      });
      if (!country) {
        throw new AppError(400, 'INVALID_COUNTRY', 'Country not supported');
      }
      countryCode = country.code;
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() } : {}),
        ...(input.starts_at !== undefined ? { startsAt: new Date(input.starts_at) } : {}),
        ...(venueId !== undefined ? { venueId } : {}),
        ...(venueName !== undefined ? { venueName } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(countryCode !== undefined ? { countryCode } : {}),
        ...(input.image_url !== undefined ? { imageUrl: input.image_url } : {}),
        ...(eventTypeId !== undefined ? { eventTypeId } : {}),
        ...(input.is_featured !== undefined ? { isFeatured: input.is_featured } : {}),
        ...(input.featured_order !== undefined ? { featuredOrder: input.featured_order } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.producer_name !== undefined
          ? { producerName: input.producer_name?.trim() || null }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      },
      include: eventInclude,
    });

    if (
      input.status === 'published' &&
      existing.status !== 'published'
    ) {
      await producerFollowNotificationsService.notifyFollowersOfPublishedEvent(
        event.id,
        event.producerName,
      );
    }

    return formatEvent(event, false);
  },

  async deleteEvent(id: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    await prisma.event.delete({ where: { id } });
    return { message: 'Event deleted successfully' };
  },
};
