import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';

async function assertPublishedEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  if (event.status === 'cancelled') {
    throw new AppError(409, 'EVENT_CANCELLED', 'Cancelled events cannot change sales status');
  }
  if (event.status !== 'published') {
    throw new AppError(409, 'EVENT_NOT_PUBLISHED', 'Only published events can pause or resume sales');
  }
  return event;
}

export const adminEventSalesService = {
  async getSalesStatus(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    return {
      event_id: eventId,
      sales_paused: event.salesPaused,
      status: event.status,
    };
  },

  async setSalesPaused(eventId: string, salesPaused: boolean) {
    const event = await assertPublishedEvent(eventId);

    if (event.salesPaused === salesPaused) {
      return {
        event_id: eventId,
        sales_paused: event.salesPaused,
        status: event.status,
      };
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: { salesPaused },
    });

    return {
      event_id: eventId,
      sales_paused: updated.salesPaused,
      status: updated.status,
    };
  },
};
