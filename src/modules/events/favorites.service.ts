import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatEvent } from './events.formatter.js';
import { producersService } from '../producers/producers.service.js';

const eventInclude = { eventType: true } as const;

async function autoFollowProducerForEvent(
  userId: string,
  producerName: string | null | undefined,
) {
  const name = producerName?.trim();
  if (!name) {
    return;
  }

  const producer = await prisma.producer.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });

  if (!producer) {
    return;
  }

  await producersService.followProducer(userId, producer.id);
}

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

    const existing = await prisma.eventFavorite.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (!existing) {
      await prisma.eventFavorite.create({ data: { userId, eventId } });
      await autoFollowProducerForEvent(userId, event.producerName);
    }

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
