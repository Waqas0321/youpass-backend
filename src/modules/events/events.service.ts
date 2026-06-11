import type { Event, EventType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatEvent, formatEventType, formatUpcomingEventCard, formatBannerSlide } from './events.formatter.js';
import type {
  CreateEventInput,
  FeaturedEventsQuery,
  ListEventsQuery,
  UpdateEventInput,
} from './events.validators.js';
import { vipVenueService } from '../vip-venue/vip-venue.service.js';
import { getCountrySync, getEventCurrencyMeta } from '../../common/services/country-config.service.js';

const eventInclude = { eventType: true } as const;

type EventWithType = Event & { eventType: EventType };

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
    exclude_ids?: string[];
  },
  eventTypeId?: string,
): Prisma.EventWhereInput {
  const searchTerm = query.search?.trim();
  return {
    status: 'published',
    startsAt: { gte: new Date() },
    ...(query.country_code ? { countryCode: query.country_code.toUpperCase() } : {}),
    ...(eventTypeId ? { eventTypeId } : {}),
    ...(query.featured === true ? { isFeatured: true } : {}),
    ...(query.exclude_ids?.length ? { id: { notIn: query.exclude_ids } } : {}),
    ...(searchTerm
      ? {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { venueName: { contains: searchTerm, mode: 'insensitive' } },
            { city: { contains: searchTerm, mode: 'insensitive' } },
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
    const slides = events.map((event) => {
      const country = getCountrySync(event.countryCode);
      return formatBannerSlide(event, favoriteIds.has(event.id), {
        timezone: country?.timezone,
        languageCode: country?.languageCode,
      });
    });

    return {
      carousel: slides.slice(0, 5),
      events: formatted,
      slides,
    };
  },

  async listUpcomingEvents(
    query: {
      country_code?: string;
      event_type?: string;
      page?: number;
      limit?: number;
      exclude_ids?: string[];
    },
    userId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const eventType = query.event_type ? await resolveEventType(query.event_type) : undefined;
    const favoriteIds = await getFavoriteIds(userId);
    const where = buildPublishedWhere(
      { country_code: query.country_code, event_type: query.event_type, exclude_ids: query.exclude_ids },
      eventType?.id,
    );
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: { startsAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    const items = events.map((event) => {
      const country = getCountrySync(event.countryCode);
      return formatUpcomingEventCard(event, favoriteIds.has(event.id), {
        timezone: country?.timezone,
        languageCode: country?.languageCode,
      });
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
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
    return {
      ...formatEvent(event, favoriteIds.has(event.id), {
        timezone: country?.timezone,
        languageCode: country?.languageCode,
      }),
      purchase,
    };
  },

  async createEvent(input: CreateEventInput) {
    const eventType = await resolveEventType(input.event_type);

    const country = await prisma.country.findFirst({
      where: { code: input.country_code.toUpperCase(), isActive: true },
    });

    if (!country) {
      throw new AppError(400, 'INVALID_COUNTRY', 'Country not supported');
    }

    const event = await prisma.event.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim(),
        startsAt: new Date(input.starts_at),
        venueName: input.venue_name.trim(),
        city: input.city.trim(),
        countryCode: country.code,
        imageUrl: input.image_url,
        eventTypeId: eventType.id,
        isFeatured: input.is_featured ?? false,
        featuredOrder: input.featured_order ?? 0,
        status: input.status ?? 'draft',
      },
      include: eventInclude,
    });

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
    if (input.country_code !== undefined) {
      const country = await prisma.country.findFirst({
        where: { code: input.country_code.toUpperCase(), isActive: true },
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
        ...(input.venue_name !== undefined ? { venueName: input.venue_name.trim() } : {}),
        ...(input.city !== undefined ? { city: input.city.trim() } : {}),
        ...(countryCode !== undefined ? { countryCode } : {}),
        ...(input.image_url !== undefined ? { imageUrl: input.image_url } : {}),
        ...(eventTypeId !== undefined ? { eventTypeId } : {}),
        ...(input.is_featured !== undefined ? { isFeatured: input.is_featured } : {}),
        ...(input.featured_order !== undefined ? { featuredOrder: input.featured_order } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: eventInclude,
    });

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
