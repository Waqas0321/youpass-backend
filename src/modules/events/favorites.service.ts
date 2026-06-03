import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatEvent } from './events.formatter.js';

const eventInclude = { eventType: true } as const;

export const favoritesService = {
  async listFavoriteEvents(userId: string) {
    const favorites = await prisma.eventFavorite.findMany({
      where: { userId },
      include: {
        event: { include: eventInclude },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites
      .filter((f) => f.event.status === 'published')
      .map((f) => formatEvent(f.event, true));
  },

  async addFavorite(userId: string, eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: eventInclude,
    });

    if (!event || event.status !== 'published') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    await prisma.eventFavorite.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: {},
    });

    return formatEvent(event, true);
  },

  async removeFavorite(userId: string, eventId: string) {
    const favorite = await prisma.eventFavorite.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (!favorite) {
      throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Event is not in your favorites');
    }

    await prisma.eventFavorite.delete({
      where: { userId_eventId: { userId, eventId } },
    });

    return { message: 'Event removed from favorites' };
  },
};
