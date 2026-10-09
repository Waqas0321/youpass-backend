import { prisma } from '../../config/database.js';

/**
 * Keeps `Event.minPrice` (used by the app's price / "free only" filters) in sync with
 * the cheapest ticket offering that is still on sale. Null when the event has none.
 */
export async function syncEventMinPrice(eventId: string): Promise<void> {
  const cheapest = await prisma.eventTicketOffering.findFirst({
    where: { eventId, status: { not: 'closed' } },
    orderBy: { price: 'asc' },
    select: { price: true },
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { minPrice: cheapest?.price ?? null },
  });
}
