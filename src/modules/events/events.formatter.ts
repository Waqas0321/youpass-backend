import type { Event, EventType } from '@prisma/client';
import { getTimezone, localeForLanguage } from '../../common/services/country-config.service.js';

type EventWithType = Event & { eventType: EventType };

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

/** Home list card: "Monday Sept 8 2025" */
export function formatEventDateListCard(date: Date, timezone = 'UTC', languageCode = 'es'): string {
  const weekday = formatInTimezone(date, timezone, languageCode, { weekday: 'long' });
  const monthDayYear = formatInTimezone(date, timezone, languageCode, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${weekday} ${monthDayYear}`.replace(/,/g, '');
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
    city: event.city,
    country_code: event.countryCode,
    location_display: formatLocationDisplay(event.venueName, event.city),
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

/** Compact card for YouHome "Upcoming events" list */
export function formatUpcomingEventCard(
  event: EventWithType,
  isFavorite = false,
  options?: { timezone?: string; languageCode?: string },
) {
  const timezone = options?.timezone ?? getTimezone(event.countryCode);
  const languageCode = options?.languageCode ?? 'es';

  return {
    id: event.id,
    title: event.title,
    image_url: event.imageUrl,
    date_display: formatEventDateListCard(event.startsAt, timezone, languageCode),
    location_display: formatLocationDisplay(event.venueName, event.city),
    starts_at: event.startsAt.toISOString(),
    country_code: event.countryCode,
    event_type: formatEventType(event.eventType),
    is_favorite: isFavorite,
  };
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
