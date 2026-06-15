import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatVenue } from './venues.formatter.js';
import type { CreateVenueInput, ListVenuesQuery, UpdateVenueInput } from './venues.validators.js';

function buildVenueWhere(query: ListVenuesQuery): Prisma.VenueWhereInput {
  const search = query.q?.trim();
  return {
    ...(query.country ? { country: query.country.toUpperCase() } : {}),
    ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export const venuesService = {
  async list(query: ListVenuesQuery = {}) {
    const venues = await prisma.venue.findMany({
      where: buildVenueWhere(query),
      orderBy: [{ country: 'asc' }, { city: 'asc' }, { name: 'asc' }],
    });
    return venues.map(formatVenue);
  },

  async getById(id: string) {
    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) {
      throw new AppError(404, 'VENUE_NOT_FOUND', 'Venue not found');
    }
    return formatVenue(venue);
  },

  async create(input: CreateVenueInput) {
    const venue = await prisma.venue.create({
      data: {
        name: input.name.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        country: input.country.toUpperCase(),
        dimensions: input.dimensions,
      },
    });
    return formatVenue(venue);
  },

  async update(id: string, input: UpdateVenueInput) {
    await venuesService.getById(id);

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        ...(input.city !== undefined ? { city: input.city.trim() } : {}),
        ...(input.country !== undefined ? { country: input.country.toUpperCase() } : {}),
        ...(input.dimensions !== undefined ? { dimensions: input.dimensions } : {}),
      },
    });

    return formatVenue(venue);
  },

  async remove(id: string) {
    await venuesService.getById(id);

    const [eventCount, layoutCount] = await Promise.all([
      prisma.event.count({ where: { venueId: id } }),
      prisma.eventVenueLayout.count({ where: { venueId: id } }),
    ]);

    if (eventCount > 0 || layoutCount > 0) {
      throw new AppError(
        409,
        'VENUE_IN_USE',
        'Venue is linked to events or layouts and cannot be deleted',
        { events: eventCount, layouts: layoutCount },
      );
    }

    await prisma.venue.delete({ where: { id } });
    return { deleted: true, id };
  },

  async resolveForLink(venueId: string) {
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) {
      throw new AppError(404, 'VENUE_NOT_FOUND', 'Venue not found');
    }
    return venue;
  },
};
