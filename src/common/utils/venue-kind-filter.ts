import type { Event, Prisma } from '@prisma/client';

const LEGACY_EVENT_TYPE_SLUGS_BY_VENUE: Record<string, string[]> = {
  stadium: ['sports'],
  club_nightclub: ['parties'],
  theatre: ['theatre'],
  bar_restaurant: ['bar'],
  open_air: ['concerts', 'parties'],
  events_centre: ['concerts', 'theatre'],
  other: [],
};

export function deriveVenueKind(input: {
  eventTypeSlug: string;
  venueName: string;
  venueKind?: Event['venueKind'] | null;
}): Event['venueKind'] {
  if (input.venueKind) {
    return input.venueKind;
  }

  const venueLower = input.venueName.toLowerCase();
  if (input.eventTypeSlug === 'sports') return 'stadium';
  if (input.eventTypeSlug === 'parties') return 'club_nightclub';
  if (input.eventTypeSlug === 'theatre') return 'theatre';
  if (input.eventTypeSlug === 'bar') return 'bar_restaurant';
  if (venueLower.includes('park') || venueLower.includes('parque') || venueLower.includes('costanera')) {
    return 'open_air';
  }
  if (venueLower.includes('teatro') || venueLower.includes('theatre')) {
    return 'theatre';
  }
  if (venueLower.includes('bar') || venueLower.includes('club')) {
    return venueLower.includes('club') ? 'club_nightclub' : 'bar_restaurant';
  }

  return 'other';
}

export function buildVenueKindWhere(venueKind: string): Prisma.EventWhereInput {
  const legacySlugs = LEGACY_EVENT_TYPE_SLUGS_BY_VENUE[venueKind] ?? [];

  return {
    OR: [
      { venueKind: venueKind as Event['venueKind'] },
      ...(legacySlugs.length
        ? [{ venueKind: null, eventType: { slug: { in: legacySlugs } } }]
        : []),
    ],
  };
}
