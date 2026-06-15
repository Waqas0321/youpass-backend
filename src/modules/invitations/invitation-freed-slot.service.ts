import type { Invitation, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

type FreedSlotInput = {
  eventId: string;
  producerId: string;
  slotLabel: string;
  invitationId?: string;
};

export async function recordFreedInvitationSlot(
  tx: Prisma.TransactionClient,
  input: FreedSlotInput,
): Promise<string | null> {
  if (!input.slotLabel.trim()) {
    return null;
  }

  const created = await tx.freedInvitationSlot.create({
    data: {
      eventId: input.eventId,
      producerId: input.producerId,
      slotLabel: input.slotLabel.trim(),
      invitationId: input.invitationId,
      releasedAt: new Date(),
    },
  });

  return created.id;
}

export async function releaseProducerInvitationSlot(
  tx: Prisma.TransactionClient,
  invitation: Pick<
    Invitation,
    'id' | 'eventId' | 'producerId' | 'assignedSlot' | 'source'
  >,
): Promise<string | null> {
  if (invitation.source !== 'producer' || !invitation.assignedSlot) {
    return null;
  }

  return recordFreedInvitationSlot(tx, {
    eventId: invitation.eventId,
    producerId: invitation.producerId,
    slotLabel: invitation.assignedSlot,
    invitationId: invitation.id,
  });
}

export function formatFreedSlotDuration(releasedAt: Date, now = new Date()) {
  const ms = now.getTime() - releasedAt.getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return {
    available_hours: hours,
    available_minutes: minutes,
    available_label:
      hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m` : 'just now',
  };
}

export async function markFreedSlotReinvited(freedSlotId: string): Promise<void> {
  await prisma.freedInvitationSlot.update({
    where: { id: freedSlotId },
    data: { reinvitedAt: new Date() },
  });
}
