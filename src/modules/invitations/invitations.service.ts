import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { buildClaimUrl } from '../messaging/invitation-delivery.service.js';
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
  inviter: true,
} as const;

type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

async function userHasPaymentMethod(userId: string): Promise<boolean> {
  const count = await prisma.userPaymentMethod.count({ where: { userId, isDefault: true } });
  return count > 0;
}

async function ensureRecipientAccess(invitation: InvitationRow, userId: string, userPhone: string) {
  const phoneMatch =
    invitation.recipientUserId === userId ||
    (invitation.recipientPhone === userPhone &&
      (invitation.recipientUserId == null || invitation.recipientUserId === userId));

  if (!phoneMatch) {
    throw new AppError(403, 'INVITATION_FORBIDDEN', 'Invitation not found');
  }

  if (!invitation.recipientUserId && invitation.recipientPhone === userPhone) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { recipientUserId: userId },
    });
    invitation.recipientUserId = userId;
  }
}

async function getInvitationForUser(id: string, userId: string, userPhone: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: invitationInclude,
  });

  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }

  await ensureRecipientAccess(invitation, userId, userPhone);
  return invitation;
}

function buildListWhere(userId: string, userPhone: string, query: ListInvitationsQuery): Prisma.InvitationWhereInput {
  const where: Prisma.InvitationWhereInput = {
    OR: [{ recipientUserId: userId }, { recipientPhone: userPhone, recipientUserId: null }],
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

  if (query.source) {
    where.source = query.source;
  }

  if (query.search) {
    const term = query.search.trim();
    where.AND = [
      {
        OR: [
          { event: { title: { contains: term } } },
          { event: { city: { contains: term } } },
          { event: { venueName: { contains: term } } },
          { producer: { name: { contains: term } } },
          { inviter: { fullName: { contains: term } } },
        ],
      },
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
  async listInvitations(userId: string, userPhone: string, query: ListInvitationsQuery) {
    const invitations = await prisma.invitation.findMany({
      where: buildListWhere(userId, userPhone, query),
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

  async getInvitationDetail(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);
    const hasPaymentMethod = await userHasPaymentMethod(userId);

    if (!invitation.viewedAt) {
      await prisma.invitation.update({
        where: { id },
        data: { viewedAt: new Date() },
      });
    }

    return formatInvitationDetail(invitation, hasPaymentMethod);
  },

  async getSummary(userId: string, userPhone: string) {
    const recipientFilter: Prisma.InvitationWhereInput = {
      OR: [{ recipientUserId: userId }, { recipientPhone: userPhone, recipientUserId: null }],
    };

    const [pending, total, newCount] = await Promise.all([
      prisma.invitation.count({
        where: { ...recipientFilter, status: 'pending' },
      }),
      prisma.invitation.count({
        where: {
          ...recipientFilter,
          status: { in: ['pending', 'confirmed'] },
        },
      }),
      prisma.invitation.count({
        where: {
          ...recipientFilter,
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

  async getClaimPreview(token: string) {
    const invitation = await prisma.invitation.findFirst({
      where: { claimToken: token, source: 'guest', status: 'pending' },
      include: { event: true, inviter: true, producer: true },
    });

    if (!invitation) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', 'Invitation link is invalid or expired');
    }

    const timezone = getTimezone(invitation.event.countryCode);

    return {
      claim_token: token,
      event_title: invitation.event.title,
      event_starts_at: invitation.event.startsAt.toISOString(),
      location: `${invitation.event.venueName}, ${invitation.event.city}`,
      date_time_label: invitation.event.startsAt.toLocaleString('en-GB', {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      invited_by: invitation.inviter?.fullName ?? 'A YouPass user',
      guest_name: invitation.recipientName,
      guest_phone_hint: invitation.recipientPhone?.slice(-4) ?? null,
      claim_url: buildClaimUrl(token),
      steps: [
        'Download the YouPass app',
        'Register or log in with the invited phone number',
        'Open Invitations and accept your ticket',
      ],
    };
  },

  async confirmInvitation(userId: string, userPhone: string, id: string, _input: ConfirmInvitationInput) {
    const invitation = await getInvitationForUser(id, userId, userPhone);

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
          recipientUserId: userId,
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

      if (invitation.source === 'guest') {
        const slot = await tx.ticketSlot.findFirst({ where: { invitationId: id } });
        if (slot) {
          await tx.ticketSlot.update({
            where: { id: slot.id },
            data: { status: 'claimed' },
          });
        }
      }

      return tx.invitation.findUniqueOrThrow({
        where: { id },
        include: invitationInclude,
      });
    });

    return formatInvitationListItem(updated);
  },

  async rejectInvitation(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);

    if (invitation.status === 'confirmed') {
      throw new AppError(409, 'INVITATION_ALREADY_CONFIRMED', 'Already confirmed');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id },
        data: {
          status: 'rejected',
          respondedAt: new Date(),
          recipientUserId: userId,
        },
      });

      if (invitation.source === 'guest') {
        const slot = await tx.ticketSlot.findFirst({ where: { invitationId: id } });
        if (slot) {
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
      }

      return tx.invitation.findUniqueOrThrow({
        where: { id },
        include: invitationInclude,
      });
    });

    return formatInvitationListItem(updated);
  },

  async getTicket(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);

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
