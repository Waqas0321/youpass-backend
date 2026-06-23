import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';

async function loadPurchasedInvitationIds(userId: string): Promise<Set<string>> {
  const invitations = await prisma.invitation.findMany({
    where: { recipientUserId: userId },
    select: { id: true },
  });

  if (invitations.length === 0) {
    return new Set();
  }

  const paidSlots = await prisma.ticketSlot.findMany({
    where: {
      invitationId: { in: invitations.map((row) => row.id) },
      order: { status: 'paid' },
    },
    select: { invitationId: true },
  });

  return new Set(
    paidSlots.map((slot) => slot.invitationId).filter((id): id is string => id != null),
  );
}

export async function assertUserHasTicketForEvent(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  const purchasedInvitationIds = await loadPurchasedInvitationIds(userId);
  if (purchasedInvitationIds.size === 0) {
    throw new AppError(403, 'DRINK_MENU_FORBIDDEN', 'A paid ticket is required for this event');
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      recipientUserId: userId,
      eventId,
      id: { in: [...purchasedInvitationIds] },
    },
    select: { id: true },
  });

  if (!invitation) {
    throw new AppError(403, 'DRINK_MENU_FORBIDDEN', 'You do not have a ticket for this event');
  }

  return event;
}
