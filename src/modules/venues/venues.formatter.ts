import type { Venue } from '@prisma/client';
import { parseVenueDimensions } from './venues.types.js';

export function formatVenue(venue: Venue) {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    country: venue.country,
    dimensions: parseVenueDimensions(venue.dimensions),
    created_at: venue.createdAt.toISOString(),
    updated_at: venue.updatedAt.toISOString(),
  };
}
