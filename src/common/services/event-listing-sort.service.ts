import type { Event } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { estimateCarTravelMinutes, resolveEventDistanceKm, type GeoPoint } from '../utils/geo-distance.js';

export type EventListingSortWeights = {
  dateWeight: number;
  locationWeight: number;
  featuredWeight: number;
  pageSize: number;
};

const DEFAULT_WEIGHTS: EventListingSortWeights = {
  dateWeight: 0.5,
  locationWeight: 0.3,
  featuredWeight: 0.2,
  pageSize: 20,
};

export type SortableEvent = Pick<
  Event,
  'startsAt' | 'isFeatured' | 'latitude' | 'longitude'
>;

export function timeProximityScore(startsAt: Date, now = new Date()): number {
  const msUntil = startsAt.getTime() - now.getTime();
  if (msUntil <= 0) {
    return 0;
  }

  const daysUntil = msUntil / (1000 * 60 * 60 * 24);
  return 1 / (1 + daysUntil);
}

export function geoProximityScore(distanceKm: number | null): number {
  if (distanceKm == null) {
    return 0;
  }

  return 1 / (1 + distanceKm / 25);
}

export function computeListingScore(
  event: SortableEvent,
  weights: EventListingSortWeights,
  options?: {
    userLocation?: GeoPoint | null;
    now?: Date;
  },
): number {
  const now = options?.now ?? new Date();
  const distanceKm = resolveEventDistanceKm(event, options?.userLocation);
  const timeScore = timeProximityScore(event.startsAt, now);
  const geoScore = geoProximityScore(distanceKm);
  const featuredScore = event.isFeatured ? 1 : 0;

  return (
    weights.dateWeight * timeScore +
    weights.locationWeight * geoScore +
    weights.featuredWeight * featuredScore
  );
}

export function sortEventsForListing<T extends SortableEvent>(
  events: T[],
  weights: EventListingSortWeights,
  options?: {
    userLocation?: GeoPoint | null;
    nearMe?: boolean;
    now?: Date;
  },
): T[] {
  const copy = [...events];

  if (options?.nearMe && options.userLocation) {
    return copy.sort((left, right) => {
      const leftDistance = resolveEventDistanceKm(left, options.userLocation) ?? Number.MAX_SAFE_INTEGER;
      const rightDistance =
        resolveEventDistanceKm(right, options.userLocation) ?? Number.MAX_SAFE_INTEGER;
      return leftDistance - rightDistance;
    });
  }

  return copy.sort((left, right) => {
    const rightScore = computeListingScore(right, weights, options);
    const leftScore = computeListingScore(left, weights, options);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.startsAt.getTime() - right.startsAt.getTime();
  });
}

export function paginateSortedEvents<T>(events: T[], page: number, limit: number) {
  const skip = (page - 1) * limit;
  return events.slice(skip, skip + limit);
}

export const eventListingConfigService = {
  async getWeights(): Promise<EventListingSortWeights> {
    const config = await prisma.eventListingConfig.findUnique({
      where: { configKey: 'default' },
    });

    if (!config) {
      return DEFAULT_WEIGHTS;
    }

    return {
      dateWeight: config.dateWeight,
      locationWeight: config.locationWeight,
      featuredWeight: config.featuredWeight,
      pageSize: config.pageSize,
    };
  },

  async updateWeights(input: Partial<EventListingSortWeights>) {
    const current = await this.getWeights();
    const next = {
      dateWeight: input.dateWeight ?? current.dateWeight,
      locationWeight: input.locationWeight ?? current.locationWeight,
      featuredWeight: input.featuredWeight ?? current.featuredWeight,
      pageSize: input.pageSize ?? current.pageSize,
    };

    const record = await prisma.eventListingConfig.upsert({
      where: { configKey: 'default' },
      create: {
        configKey: 'default',
        ...next,
      },
      update: next,
    });

    return {
      date_weight: record.dateWeight,
      location_weight: record.locationWeight,
      featured_weight: record.featuredWeight,
      page_size: record.pageSize,
      updated_at: record.updatedAt.toISOString(),
    };
  },

  formatWeights(weights: EventListingSortWeights) {
    return {
      date_weight: weights.dateWeight,
      location_weight: weights.locationWeight,
      featured_weight: weights.featuredWeight,
      page_size: weights.pageSize,
    };
  },
};

export function buildListingProximityMeta(
  event: Pick<Event, 'latitude' | 'longitude'>,
  userLocation?: GeoPoint | null,
) {
  const distanceKm = resolveEventDistanceKm(event, userLocation);
  if (distanceKm == null) {
    return {
      distance_km: null,
      travel_time_minutes: null,
    };
  }

  return {
    distance_km: Math.round(distanceKm * 10) / 10,
    travel_time_minutes: estimateCarTravelMinutes(distanceKm),
  };
}
