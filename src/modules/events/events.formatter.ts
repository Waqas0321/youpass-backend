import type { Event, EventType, Venue } from '@prisma/client';
import { getTimezone, localeForLanguage } from '../../common/services/country-config.service.js';
import { formatVenue } from '../venues/venues.formatter.js';

type EventWithType = Event & { eventType: EventType; venue?: Venue | null };

function formatInTimezone(date: Date, timezone: string, languageCode: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeForLanguage(languageCode), {
    ...options,
    timeZone: timezone,
  }).format(date);
}

export function formatEventDate(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  return formatInTimezone(date, timezone, languageCode, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatEventTime(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  return formatInTimezone(date, timezone, languageCode, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatEventDateShort(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  return formatInTimezone(date, timezone, languageCode, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Event detail: "Saturday 15 May · 22:00" */
export function formatEventDetailSchedule(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  const weekday = formatInTimezone(date, timezone, languageCode, { weekday: 'long' });
  const day = formatInTimezone(date, timezone, languageCode, { day: 'numeric' });
  const month = formatInTimezone(date, timezone, languageCode, { month: 'long' });
  const time = formatInTimezone(date, timezone, languageCode, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${weekday} ${day} ${month} · ${time}`;
}

/** Home list card: "Wednesday, 11 March 2026" */
export function formatEventListingDate(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  const weekday = formatInTimezone(date, timezone, languageCode, { weekday: 'long' });
  const day = formatInTimezone(date, timezone, languageCode, { day: 'numeric' });
  const month = formatInTimezone(date, timezone, languageCode, { month: 'long' });
  const year = formatInTimezone(date, timezone, languageCode, { year: 'numeric' });
  return `${weekday}, ${day} ${month} ${year}`;
}

/** @deprecated Use formatEventListingDate */
export function formatEventDateListCard(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  return formatEventListingDate(date, timezone, languageCode);
}

function formatLocationDisplay(venueName: string, city: string): string {
  const venue = venueName.trim();
  const cityTrim = city.trim();
  if (!cityTrim || venue.toLowerCase().includes(cityTrim.toLowerCase())) {
    return venue;
  }
  if (/\d/.test(venue) || venue.includes(',')) {
    return venue;
  }
  return `${venue}, ${cityTrim}`;
}

export function formatEventType(eventType: EventType) {
  return {
    id: eventType.id,
    slug: eventType.slug,
    name: eventType.name,
    icon: eventType.icon,
  };
}

export function formatEvent(
  event: EventWithType,
  isFavorite = false,
  options?: { timezone?: string; languageCode?: string },
) {
  const timezone = options?.timezone ?? getTimezone(event.countryCode);
  const languageCode = options?.languageCode ?? 'es';
  const dateShort = formatEventDateShort(event.startsAt, timezone, languageCode);
  const time = formatEventTime(event.startsAt, timezone, languageCode);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    starts_at: event.startsAt.toISOString(),
    timezone,
    starts_at_display: formatEventDate(event.startsAt, timezone, languageCode),
    starts_at_short: dateShort,
    starts_at_time: time,
    date_time_display: `${dateShort} · ${time}`,
    venue_name: event.venueName,
    venue_id: event.venueId ?? null,
    physical_venue: event.venue ? formatVenue(event.venue) : null,
    city: event.city,
    country_code: event.countryCode,
    location_display: formatLocationDisplay(event.venueName, event.city),
    latitude: event.latitude,
    longitude: event.longitude,
    image_url: event.imageUrl,
    event_type: formatEventType(event.eventType),
    is_featured: event.isFeatured,
    featured_order: event.featuredOrder,
    status: event.status,
    is_favorite: isFavorite,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
  };
}

export function formatEventProducerBlock(
  producer: {
    id: string;
    name: string;
    logoUrl: string | null;
    followerCount: number;
    description?: string | null;
    typeLabel?: string | null;
    coverageLabel?: string | null;
  },
  isFollowing: boolean,
) {
  return {
    id: producer.id,
    name: producer.name,
    logo_url: producer.logoUrl,
    type_label: producer.typeLabel ?? null,
    description: producer.description ?? null,
    coverage_label: producer.coverageLabel ?? null,
    follower_count: producer.followerCount,
    is_following: isFollowing,
  };
}

/** Minimal listing card payload for home/search event lists (Section 8.6). */
export function formatEventListingCard(
  event: EventWithType,
  options?: {
    timezone?: string;
    languageCode?: string;
    distance_km?: number | null;
    travel_time_minutes?: number | null;
    waitlist?: Record<string, unknown> | null;
  },
) {
  const timezone = options?.timezone ?? getTimezone(event.countryCode);
  const languageCode = options?.languageCode ?? 'es';

  return {
    id: event.id,
    title: event.title,
    image_url: event.imageUrl,
    date_display: formatEventListingDate(event.startsAt, timezone, languageCode),
    location_display: formatLocationDisplay(event.venueName, event.city),
    starts_at: event.startsAt.toISOString(),
    ...(options?.distance_km != null
      ? {
          distance_km: options.distance_km,
          travel_time_minutes: options.travel_time_minutes ?? null,
        }
      : {}),
    ...(options?.waitlist ? { waitlist: options.waitlist } : {}),
  };
}

/** Compact card for YouHome "Upcoming events" list */
export function formatUpcomingEventCard(
  event: EventWithType,
  _isFavorite = false,
  options?: {
    timezone?: string;
    languageCode?: string;
    distance_km?: number | null;
    travel_time_minutes?: number | null;
    waitlist?: Record<string, unknown> | null;
  },
) {
  return formatEventListingCard(event, options);
}

/** Hero carousel slide for main banner */
export function formatBannerSlide(
  event: EventWithType,
  isFavorite = false,
  options?: { timezone?: string; languageCode?: string },
) {
  const timezone = options?.timezone ?? getTimezone(event.countryCode);
  const languageCode = options?.languageCode ?? 'es';
  const dateShort = formatEventDateShort(event.startsAt, timezone, languageCode);
  const time = formatEventTime(event.startsAt, timezone, languageCode);

  return {
    id: event.id,
    title: event.title,
    image_url: event.imageUrl,
    date_display: formatEventDateListCard(event.startsAt, timezone, languageCode),
    date_time_display: `${dateShort} · ${time}`,
    location_display: formatLocationDisplay(event.venueName, event.city),
    event_type: formatEventType(event.eventType),
    is_favorite: isFavorite,
  };
}
