import { prisma } from '../../config/database.js';

/**
 * Notifies users who follow a promoter when a new event is published.
 * Push + WhatsApp delivery hooks — integrate with messaging providers here.
 */
export const producerFollowNotificationsService = {
  async notifyFollowersOfPublishedEvent(eventId: string, producerName: string | null | undefined) {
    if (!producerName?.trim()) {
      return { notified: 0 };
    }

    const producer = await prisma.producer.findFirst({
      where: { name: producerName.trim() },
    });
    if (!producer) {
      return { notified: 0 };
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, status: true },
    });
    if (!event || event.status !== 'published') {
      return { notified: 0 };
    }

    const followers = await prisma.producerFollow.findMany({
      where: { producerId: producer.id },
      select: { userId: true },
    });

    for (const follow of followers) {
      console.info('[producer-notification]', {
        userId: follow.userId,
        producerId: producer.id,
        eventId,
        channels: ['push', 'whatsapp'],
        message: `${producer.name} just published a new event — check it out!`,
      });
      // TODO(iteration-2): dispatch push notification + WhatsApp via messaging service
    }

    return { notified: followers.length };
  },
};
