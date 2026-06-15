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
    description: producer.description,
    coverage_label: producer.coverageLabel ?? 'Events across Chile',
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
  const now = new Date();
  const publishedRecently =
    event.createdAt.getTime() > now.getTime() - options.presaleWindowHours * 60 * 60 * 1000;
  const followersPresaleActive = options.isFollower && publishedRecently;
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
    ticket_cta: followersPresaleActive ? 'presale' : 'buy',
    followers_presale_active: followersPresaleActive,
    followers_presale_label: followersPresaleActive
      ? `Exclusive pre-sale for followers`
      : null,
    can_purchase: true,
  };
}
