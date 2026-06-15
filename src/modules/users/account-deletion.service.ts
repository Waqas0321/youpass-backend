import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

const ANONYMIZED_EMAIL_DOMAIN = 'deleted.youpass.invalid';

async function cancelActiveTicketsForUser(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
) {
  const paidOrders = await tx.ticketOrder.findMany({
    where: { buyerUserId: userId, status: 'paid' },
    include: {
      event: { select: { startsAt: true, status: true } },
      slots: { select: { id: true, invitationId: true } },
    },
  });

  for (const order of paidOrders) {
    const isFutureEvent = order.event.startsAt > now;
    const isActiveEvent = order.event.status !== 'cancelled';
    if (!isFutureEvent || !isActiveEvent) {
      continue;
    }

    await tx.ticketOrder.update({
      where: { id: order.id },
      data: {
        status: 'refunded',
        paymentReference: order.paymentReference
          ? `${order.paymentReference}:auto-refund-account-deletion`
          : 'auto-refund-account-deletion',
      },
    });

    const invitationIds = order.slots
      .map((slot) => slot.invitationId)
      .filter((id): id is string => id != null);

    if (invitationIds.length > 0) {
      await tx.invitation.updateMany({
        where: { id: { in: invitationIds }, status: { in: ['sent', 'viewed', 'accepted'] } },
        data: { status: 'canceled', respondedAt: now },
      });
    }
  }
}

async function anonymizeUserRecord(tx: Prisma.TransactionClient, userId: string) {
  const anonymizedPhone = `deleted-${userId}`;
  const anonymizedEmail = `deleted+${userId}@${ANONYMIZED_EMAIL_DOMAIN}`;

  await tx.user.update({
    where: { id: userId },
    data: {
      accountStatus: 'deleted',
      fullName: 'Deleted User',
      email: anonymizedEmail,
      phone: anonymizedPhone,
      instagramUsername: null,
      profilePhotoUrl: null,
      pendingPhoneChange: null,
      deletionRequestedAt: null,
      deletionScheduledAt: null,
      rutOrPassport: `ANON-${userId.slice(-8)}`,
    },
  });
}

export const accountDeletionService = {
  async finalizeDeletion(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.accountStatus !== 'pending_deletion' || !user.deletionScheduledAt) {
      return { finalized: false };
    }

    if (user.deletionScheduledAt > new Date()) {
      return { finalized: false };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await cancelActiveTicketsForUser(tx, userId, now);

      await tx.userPaymentMethod.deleteMany({ where: { userId } });
      await tx.userNotificationSettings.deleteMany({ where: { userId } });
      await tx.userProfileCompletion.deleteMany({ where: { userId } });

      const sessions = await tx.userSession.findMany({
        where: { userId, revokedAt: null },
        select: { id: true, tokenHash: true },
      });

      if (sessions.length > 0) {
        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      await anonymizeUserRecord(tx, userId);
    });

    console.log(
      `[account-deletion] Finalized deletion for user ${userId}. ` +
        `Deletion confirmation email would be sent to ${user.email}.`,
    );

    return { finalized: true, user_id: userId };
  },

  async processDueDeletions() {
    const now = new Date();
    const dueUsers = await prisma.user.findMany({
      where: {
        accountStatus: 'pending_deletion',
        deletionScheduledAt: { lte: now },
      },
      select: { id: true },
    });

    let finalized = 0;
    for (const user of dueUsers) {
      const result = await this.finalizeDeletion(user.id);
      if (result.finalized) {
        finalized += 1;
      }
    }

    return finalized;
  },

  async sendDailyReminderIfNeeded(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.accountStatus !== 'pending_deletion' || !user.deletionScheduledAt) {
      return { sent: false };
    }

    console.log(
      `[account-deletion] Daily reminder for ${user.email}: ` +
        `account deletes on ${user.deletionScheduledAt.toISOString()}`,
    );

    return { sent: true, deletion_scheduled_at: user.deletionScheduledAt.toISOString() };
  },
};
