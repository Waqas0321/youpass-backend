import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatEvent } from '../events/events.formatter.js';
import { formatProducerCalendarEvent, formatProducerFavorite } from './producers.formatter.js';
import { producerPresaleConfigService } from './producer-presale-config.service.js';

const eventInclude = { eventType: true } as const;

async function resolveProducerById(producerId: string) {
  const producer = await prisma.producer.findUnique({ where: { id: producerId } });
  if (!producer) {
    throw new AppError(404, 'PRODUCER_NOT_FOUND', 'Producer not found');
  }
  return producer;
}

async function isFollowing(userId: string, producerId: string): Promise<boolean> {
  const follow = await prisma.producerFollow.findUnique({
    where: { userId_producerId: { userId, producerId } },
  });
  return follow != null;
}

export const producersService = {
  async listFollowedProducers(userId: string) {
    const follows = await prisma.producerFollow.findMany({
      where: { userId },
      include: { producer: true },
      orderBy: { createdAt: 'desc' },
    });

    return follows.map((follow) =>
      formatProducerFavorite(follow.producer, { isFollowing: true }),
    );
  },

  async followProducer(userId: string, producerId: string) {
    await resolveProducerById(producerId);
    const existing = await prisma.producerFollow.findUnique({
      where: { userId_producerId: { userId, producerId } },
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.producerFollow.create({ data: { userId, producerId } }),
        prisma.producer.update({
          where: { id: producerId },
          data: { followerCount: { increment: 1 } },
        }),
      ]);
    }

    const updated = await prisma.producer.findUniqueOrThrow({ where: { id: producerId } });
    return formatProducerFavorite(updated, { isFollowing: true });
  },

  async unfollowProducer(userId: string, producerId: string) {
    const follow = await prisma.producerFollow.findUnique({
      where: { userId_producerId: { userId, producerId } },
    });

    if (!follow) {
      throw new AppError(404, 'PRODUCER_FOLLOW_NOT_FOUND', 'You are not following this producer');
    }

    await prisma.$transaction([
      prisma.producerFollow.delete({
        where: { userId_producerId: { userId, producerId } },
      }),
      prisma.producer.update({
        where: { id: producerId },
        data: { followerCount: { decrement: 1 } },
      }),
    ]);

    return { message: 'Producer unfollowed' };
  },

  async getProducerProfile(producerId: string, userId?: string) {
    const producer = await resolveProducerById(producerId);
    const following = userId ? await isFollowing(userId, producerId) : false;
    return formatProducerFavorite(producer, { isFollowing: following });
  },

  async listUpcomingEvents(producerId: string, userId?: string) {
    const producer = await resolveProducerById(producerId);
    const following = userId ? await isFollowing(userId, producerId) : false;
    const presaleWindowHours = await producerPresaleConfigService.getPresaleWindowHours();
    const now = new Date();

    const favoriteIds = userId
      ? new Set(
          (
            await prisma.eventFavorite.findMany({
              where: { userId },
              select: { eventId: true },
            })
          ).map((item) => item.eventId),
        )
      : new Set<string>();

    const events = await prisma.event.findMany({
      where: {
        status: 'published',
        startsAt: { gte: now },
        producerName: producer.name,
      },
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
    });

    return {
      producer: formatProducerFavorite(producer, { isFollowing: following }),
      events: events.map((event) =>
        formatProducerCalendarEvent(event, {
          isFollower: following,
          presaleWindowHours,
          isFavorite: favoriteIds.has(event.id),
        }),
      ),
      meta: {
        total: events.length,
        is_follower: following,
        presale_window_hours: presaleWindowHours,
      },
    };
  },

  async assertFollowerPresaleAccess(_userId: string, _eventId: string) {
    return { allowed: true };
  },
};

export const producerFavoritesService = {
  listFollowedProducers: producersService.listFollowedProducers,
  followProducer: producersService.followProducer,
  unfollowProducer: producersService.unfollowProducer,
};

export const favoritesCombinedService = {
  async listAllFavorites(userId: string) {
    const [producers, eventFavorites] = await Promise.all([
      producersService.listFollowedProducers(userId),
      prisma.eventFavorite.findMany({
        where: { userId },
        include: { event: { include: eventInclude } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const events = eventFavorites
      .filter((favorite) => favorite.event.status === 'published')
      .map((favorite) => ({
        type: 'event' as const,
        ...formatEvent(favorite.event, true),
      }));

    return {
      producers,
      events,
      meta: {
        producers_count: producers.length,
        events_count: events.length,
      },
    };
  },
};
