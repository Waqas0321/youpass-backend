import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  formatInvitationDetail,
  formatInvitationListItem,
  formatInvitationTicket,
  getTimezone,
} from './invitations.formatter.js';
import {
  detectCardBrand,
  eventDayStart,
  generateEntryCode,
  generateQrPayload,
  maskCardLastFour,
  resolveQrStatus,
} from './invitations.utils.js';
import type { ConfirmInvitationInput, ListInvitationsQuery, SavePaymentMethodInput } from './invitations.validators.js';

const invitationInclude = {
  event: true,
  producer: true,
  ticket: true,
} as const;

async function userHasPaymentMethod(userId: string): Promise<boolean> {
  const count = await prisma.userPaymentMethod.count({ where: { userId, isDefault: true } });
  return count > 0;
}

async function getInvitationForUser(id: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: invitationInclude,
  });

  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }

  if (invitation.recipientUserId !== userId) {
    throw new AppError(403, 'INVITATION_FORBIDDEN', 'Invitation not found');
  }

  return invitation;
}

function buildListWhere(userId: string, query: ListInvitationsQuery): Prisma.InvitationWhereInput {
  const where: Prisma.InvitationWhereInput = {
    recipientUserId: userId,
    status: { notIn: ['expired', 'canceled'] },
  };

  if (query.status) {
    const statuses = query.status.split(',').map((s) => s.trim()) as Prisma.EnumInvitationStatusFilter['in'];
    where.status = { in: statuses };
  }

  if (query.tier) {
    where.tier = query.tier;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { event: { title: { contains: term } } },
      { event: { city: { contains: term } } },
      { event: { venueName: { contains: term } } },
      { producer: { name: { contains: term } } },
    ];
  }

  return where;
}

function sortInvitations<T extends { status: string; sentAt: Date; event: { startsAt: Date } }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (a.status === 'pending' && b.status === 'pending') {
      return b.sentAt.getTime() - a.sentAt.getTime();
    }
    return a.event.startsAt.getTime() - b.event.startsAt.getTime();
  });
}

export const invitationsService = {
  async listInvitations(userId: string, query: ListInvitationsQuery) {
    const invitations = await prisma.invitation.findMany({
      where: buildListWhere(userId, query),
      include: invitationInclude,
    });

    const sorted = sortInvitations(invitations);
    const formatted = sorted.map(formatInvitationListItem);

    const pendingCount = formatted.filter((i) => i.status === 'pending').length;
    const confirmedCount = formatted.filter((i) => i.status === 'confirmed').length;

    return {
      invitations: formatted,
      meta: {
        total: formatted.length,
        pending_count: pendingCount,
        confirmed_count: confirmedCount,
      },
    };
  },

  async getInvitationDetail(userId: string, id: string) {
    const invitation = await getInvitationForUser(id, userId);
    const hasPaymentMethod = await userHasPaymentMethod(userId);

    if (!invitation.viewedAt) {
      await prisma.invitation.update({
        where: { id },
        data: { viewedAt: new Date() },
      });
    }

    return formatInvitationDetail(invitation, hasPaymentMethod);
  },

  async getSummary(userId: string) {
    const [pending, total, newCount] = await Promise.all([
      prisma.invitation.count({
        where: { recipientUserId: userId, status: 'pending' },
      }),
      prisma.invitation.count({
        where: {
          recipientUserId: userId,
          status: { in: ['pending', 'confirmed'] },
        },
      }),
      prisma.invitation.count({
        where: {
          recipientUserId: userId,
          status: 'pending',
          viewedAt: null,
        },
      }),
    ]);

    return {
      pending_count: pending,
      new_count: newCount,
      total_count: total,
    };
  },

  async confirmInvitation(userId: string, id: string, _input: ConfirmInvitationInput) {
    const invitation = await getInvitationForUser(id, userId);

    if (invitation.status === 'confirmed') {
      throw new AppError(409, 'INVITATION_ALREADY_CONFIRMED', 'Already confirmed');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    if (
      invitation.cancellationDeadline &&
      new Date() > invitation.cancellationDeadline
    ) {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    if (invitation.event.status === 'cancelled') {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Event has been cancelled');
    }

    if (invitation.requiresPaymentMethod && !(await userHasPaymentMethod(userId))) {
      throw new AppError(422, 'PAYMENT_METHOD_REQUIRED', 'Add a payment method before confirming');
    }

    const timezone = getTimezone(invitation.event.countryCode);
    const unlockAt = eventDayStart(invitation.event.startsAt, timezone);
    const entryCode = generateEntryCode();
    const ticketId = crypto.randomBytes(12).toString('hex');
    const qrPayload = generateQrPayload(ticketId, invitation.eventId);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id },
        data: {
          status: 'confirmed',
          respondedAt: new Date(),
        },
      });

      await tx.invitationTicket.create({
        data: {
          id: ticketId,
          invitationId: id,
          manualEntryId: entryCode,
          qrPayload,
          unlockAt,
        },
      });

      return tx.invitation.findUniqueOrThrow({
        where: { id },
        include: invitationInclude,
      });
    });

    return formatInvitationListItem(updated);
  },

  async rejectInvitation(userId: string, id: string) {
    const invitation = await getInvitationForUser(id, userId);

    if (invitation.status === 'confirmed') {
      throw new AppError(409, 'INVITATION_ALREADY_CONFIRMED', 'Already confirmed');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    const updated = await prisma.invitation.update({
      where: { id },
      data: {
        status: 'rejected',
        respondedAt: new Date(),
      },
      include: invitationInclude,
    });

    return formatInvitationListItem(updated);
  },

  async getTicket(userId: string, id: string) {
    const invitation = await getInvitationForUser(id, userId);

    if (invitation.status !== 'confirmed' || !invitation.ticket) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Ticket not found');
    }

    const timezone = getTimezone(invitation.event.countryCode);
    const qrStatus = resolveQrStatus(
      invitation.ticket.unlockAt,
      invitation.ticket.validatedAt,
      invitation.event.startsAt,
    );

    if (qrStatus === 'locked') {
      throw new AppError(
        423,
        'QR_LOCKED',
        'Your QR will be available from 00:00 on the day of the event',
        { unlock_at: invitation.ticket.unlockAt.toISOString() },
      );
    }

    if (qrStatus === 'expired' || qrStatus === 'redeemed') {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Ticket is no longer available');
    }

    return formatInvitationTicket(invitation, timezone);
  },
};

export const paymentMethodsService = {
  async listPaymentMethods(userId: string) {
    const methods = await prisma.userPaymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return methods.map((m) => ({
      id: m.providerToken,
      brand: m.brand,
      last_four: m.lastFour,
      is_default: m.isDefault,
      cardholder_name: m.cardholderName,
    }));
  },

  async savePaymentMethod(userId: string, input: SavePaymentMethodInput) {
    const lastFour = maskCardLastFour(input.card_number);
    const brand = detectCardBrand(input.card_number);
    const providerToken = `pm_${crypto.randomBytes(8).toString('hex')}`;

    await prisma.userPaymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    await prisma.userPaymentMethod.create({
      data: {
        userId,
        providerToken,
        brand,
        lastFour,
        cardholderName: input.cardholder_name.trim(),
        isDefault: true,
      },
    });

    return {
      id: providerToken,
      brand,
      last_four: lastFour,
      is_default: true,
    };
  },

  async hasDefaultPaymentMethod(userId: string): Promise<boolean> {
    return userHasPaymentMethod(userId);
  },
};
