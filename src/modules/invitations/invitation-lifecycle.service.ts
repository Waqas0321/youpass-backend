import type { Invitation, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  invitationConfigService,
} from '../../common/services/invitation-config.service.js';
import { releasePreauthorizedPayment } from './invitation-payment.service.js';
import { releaseProducerInvitationSlot } from './invitation-freed-slot.service.js';
import { invitationPreAuthService } from './invitation-preauth.service.js';

type InvitationExpiryFields = Pick<
  Invitation,
  | 'id'
  | 'sentAt'
  | 'expiresAt'
  | 'source'
  | 'status'
  | 'eventId'
  | 'producerId'
  | 'assignedSlot'
>;

export function isInvitationExpired(
  invitation: Pick<Invitation, 'sentAt' | 'expiresAt'>,
  expiryDays: number,
  now = new Date(),
): boolean {
  const expiresAt = invitationConfigService.resolveExpiresAt(invitation, expiryDays);
  return expiresAt <= now;
}

async function releaseGuestSlot(tx: Prisma.TransactionClient, invitationId: string) {
  const slot = await tx.ticketSlot.findFirst({ where: { invitationId } });
  if (!slot) {
    return;
  }

  await tx.ticketSlot.update({
    where: { id: slot.id },
    data: {
      status: 'available',
      guestName: null,
      guestPhone: null,
      guestCountryCode: null,
      invitationId: null,
    },
  });
}

export async function deleteInvitationRecord(
  tx: Prisma.TransactionClient,
  invitation: Pick<Invitation, 'id' | 'source' | 'eventId' | 'producerId' | 'assignedSlot'>,
): Promise<string | null> {
  let freedSlotId: string | null = null;

  if (invitation.source === 'guest') {
    await releaseGuestSlot(tx, invitation.id);
  } else {
    freedSlotId = await releaseProducerInvitationSlot(tx, invitation);
  }

  await tx.invitation.delete({ where: { id: invitation.id } });
  return freedSlotId;
}

export async function expireInvitationRecord(
  tx: Prisma.TransactionClient,
  invitation: InvitationExpiryFields,
): Promise<string | null> {
  const preAuth = await tx.invitationPreAuth.findUnique({
    where: { invitationId: invitation.id },
  });

  if (preAuth?.status === 'pre_authorized') {
    await releasePreauthorizedPayment(preAuth.gatewayTransactionId);
    await tx.invitationPreAuth.update({
      where: { invitationId: invitation.id },
      data: { status: 'released', releasedAt: new Date() },
    });
  }

  let freedSlotId: string | null = null;

  if (invitation.source === 'guest') {
    await releaseGuestSlot(tx, invitation.id);
  } else {
    freedSlotId = await releaseProducerInvitationSlot(tx, invitation);
  }

  await tx.invitation.update({
    where: { id: invitation.id },
    data: { status: 'expired' },
  });

  return freedSlotId;
}

function recipientWhere(userId: string, userPhone: string): Prisma.InvitationWhereInput {
  return {
    OR: [{ recipientUserId: userId }, { recipientPhone: userPhone, recipientUserId: null }],
  };
}

export async function purgeExpiredInvitationsForRecipient(
  userId: string,
  userPhone: string,
): Promise<void> {
  const { expiryDays } = await invitationConfigService.getConfig();
  const now = new Date();

  const candidates = await prisma.invitation.findMany({
    where: {
      ...recipientWhere(userId, userPhone),
      status: { in: ['sent', 'viewed'] },
    },
    select: {
      id: true,
      sentAt: true,
      expiresAt: true,
      source: true,
      status: true,
      eventId: true,
      producerId: true,
      assignedSlot: true,
    },
  });

  const expired = candidates.filter((invitation) =>
    isInvitationExpired(invitation, expiryDays, now),
  );

  if (expired.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const invitation of expired) {
      await expireInvitationRecord(tx, invitation);
    }
  });
}

export async function assertInvitationNotExpired(
  invitation: InvitationExpiryFields,
  expiryDays: number,
): Promise<void> {
  if (!['sent', 'viewed'].includes(invitation.status)) {
    return;
  }

  if (isInvitationExpired(invitation, expiryDays)) {
    await prisma.$transaction(async (tx) => {
      await expireInvitationRecord(tx, invitation);
    });
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }
}

export async function releaseInvitationPreAuthHold(invitationId: string) {
  const preAuth = await prisma.invitationPreAuth.findUnique({ where: { invitationId } });
  if (!preAuth || preAuth.status !== 'pre_authorized') {
    return null;
  }
  await releasePreauthorizedPayment(preAuth.gatewayTransactionId);
  return invitationPreAuthService.releaseInvitationPreAuth(invitationId);
}
