import type { Event, EventType, Producer } from '@prisma/client';
import { formatEventListingCard } from '../events/events.formatter.js';
import { getTimezone } from '../../common/services/country-config.service.js';

type ProducerWithMeta = Producer & {
  is_following?: boolean;
};

type EventWithType = Event & { eventType: EventType };

export function formatProducerFavorite(
  producer: ProducerWithMeta,
  options?: { isFollowing?: boolean },
) {
  return {
    type: 'producer' as const,
    id: producer.id,
    name: producer.name,
    logo_url: producer.logoUrl,
    type_label: producer.typeLabel ?? null,
    description: producer.description,
    coverage_label: producer.coverageLabel ?? null,
    follower_count: producer.followerCount,
    is_following: options?.isFollowing ?? producer.is_following ?? true,
  };
}

export function formatProducerCalendarEvent(
  event: EventWithType,
  options: {
    isFollower: boolean;
    presaleWindowHours: number;
    isFavorite?: boolean;
  },
) {
  const timezone = getTimezone(event.countryCode);
  const card = formatEventListingCard(event, { timezone, languageCode: 'es' });

  return {
    type: 'event' as const,
    ...card,
    event_type: {
      slug: event.eventType.slug,
      name: event.eventType.name,
    },
    venue_name: event.venueName,
    min_price: event.minPrice,
    currency_code: event.currencyCode,
    is_favorite: options.isFavorite ?? false,
    ticket_cta: 'buy',
    followers_presale_active: false,
    followers_presale_label: null,
    can_purchase: true,
  };
}
