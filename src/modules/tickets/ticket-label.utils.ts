import { prisma } from '../../config/database.js';

const GENERIC_SLOT_LABEL = /^Entrada \d+$/;

/**
 * Purchased tickets store a generic slot label ("Entrada 1"); door and supervisor
 * screens need the ticket type the guest bought, resolved via slot -> order -> offering.
 * Returns null when the invitation is not a purchase or has a meaningful custom label.
 */
export async function resolvePurchasedTicketName(invitation: {
  id: string;
  source: string;
  assignedSlot: string | null;
}): Promise<string | null> {
  const slotLabel = invitation.assignedSlot?.trim() ?? '';
  if (invitation.source !== 'guest' || (slotLabel && !GENERIC_SLOT_LABEL.test(slotLabel))) {
    return null;
  }

  const slot = await prisma.ticketSlot.findFirst({
    where: { invitationId: invitation.id },
    select: { order: { select: { ticketOfferingId: true } } },
  });
  const offeringId = slot?.order.ticketOfferingId;
  if (!offeringId) {
    return null;
  }

  const offering = await prisma.eventTicketOffering.findUnique({
    where: { id: offeringId },
    select: { name: true },
  });
  return offering?.name?.trim() || null;
}
