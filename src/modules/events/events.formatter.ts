import type { Event, EventType } from '@prisma/client';

type EventWithType = Event & { eventType: EventType };

export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatEventTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatEventDateShortUpper(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
    .format(date)
    .toUpperCase();
}

export function formatEventType(eventType: EventType) {
  return {
    id: eventType.id,
    slug: eventType.slug,
    name: eventType.name,
    icon: eventType.icon,
  };
}

export function formatEvent(event: EventWithType, isFavorite = false) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    starts_at: event.startsAt.toISOString(),
    starts_at_display: formatEventDate(event.startsAt),
    starts_at_short: formatEventDateShortUpper(event.startsAt),
    starts_at_time: formatEventTime(event.startsAt),
    date_time_display: `${formatEventDateShortUpper(event.startsAt)} • ${formatEventTime(event.startsAt)}`,
    venue_name: event.venueName,
    city: event.city,
    country_code: event.countryCode,
    location_display: `${event.venueName}, ${event.city}`,
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
