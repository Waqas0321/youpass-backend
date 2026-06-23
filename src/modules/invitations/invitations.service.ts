import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { buildClaimUrl } from '../messaging/invitation-delivery.service.js';
import {
  formatInvitationDetail,
  formatInvitationListItem,
  formatInvitationTicket,
  getTimezone,
} from './invitations.formatter.js';
import { repairInvitationTimestamps } from './invitation-data-repair.service.js';
import {
  assertInvitationNotExpired,
  deleteInvitationRecord,
  isInvitationExpired,
  purgeExpiredInvitationsForRecipient,
  releaseInvitationPreAuthHold,
} from './invitation-lifecycle.service.js';
import { notifyInviterInvitationDeclined } from './invitation-decline-notification.service.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';
import {
  detectCardBrand,
  eventDayStart,
  generateEntryCode,
  generateQrPayload,
  maskCardLastFour,
  resolveQrStatus,
} from './invitations.utils.js';
import { getCurrencyForCountry } from '../../common/services/country-config.service.js';
import {
  chargeInvitationPayment,
  preauthorizeInvitationPayment,
} from './invitation-payment.service.js';
import { invitationPreAuthService } from './invitation-preauth.service.js';
import { resolveInvitationProductKind, isProducerFreeWithNoShowPolicy, isZeroValueFreeInvitation, termsAcceptedRequired } from './invitation-product-type.utils.js';
import {
  guaranteedPassNotificationService,
  resolveGuestContact,
} from './guaranteed-pass-notification.service.js';
import type {
  AcceptInvitationInput,
  ConfirmInvitationInput,
  ListInvitationsQuery,
  SavePaymentMethodInput,
  TokenizedPaymentMethodInput,
} from './invitations.validators.js';
import {
  formatLifecycleStatus,
  mapListFilterToStatuses,
} from './invitation-status.utils.js';
import { invitationAuditService } from './invitation-audit.service.js';
import { waitlistService } from '../waitlist/waitlist.service.js';
import { triggerWaitlistForReleasedSlot } from '../waitlist/waitlist-slot-release.hook.js';

const invitationInclude = {
  event: { include: { eventType: true } },
  producer: true,
  ticket: true,
  inviter: true,
  recipient: true,
} as const;

type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

type ConfirmTicketPayload = {
  ticketId: string;
  entryCode: string;
  qrPayload: string;
  unlockAt: Date;
};

async function persistAcceptedInvitation(
  tx: Prisma.TransactionClient,
  invitation: InvitationRow,
  id: string,
  userId: string,
  ticket: ConfirmTicketPayload,
) {
  await tx.invitation.update({
    where: { id },
    data: {
      status: 'accepted',
      respondedAt: new Date(),
      recipientUserId: userId,
    },
  });

  if (!invitation.ticket) {
    await tx.invitationTicket.create({
      data: {
        id: ticket.ticketId,
        invitationId: id,
        manualEntryId: ticket.entryCode,
        qrPayload: ticket.qrPayload,
        unlockAt: ticket.unlockAt,
      },
    });
  }

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
}

async function userHasPaymentMethod(userId: string): Promise<boolean> {
  const count = await prisma.userPaymentMethod.count({ where: { userId, isDefault: true } });
  return count > 0;
}

async function getDefaultPaymentMethod(userId: string, paymentMethodId?: string) {
  const method = paymentMethodId
    ? await prisma.userPaymentMethod.findFirst({
        where: { userId, providerToken: paymentMethodId },
      })
    : await prisma.userPaymentMethod.findFirst({
        where: { userId, isDefault: true },
        orderBy: { createdAt: 'desc' },
      });

  if (!method) {
    throw new AppError(422, 'PAYMENT_METHOD_REQUIRED', 'Add a payment method before confirming');
  }

  return method;
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
  await purgeExpiredInvitationsForRecipient(userId, userPhone);

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: invitationInclude,
  });

  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }

  await ensureRecipientAccess(invitation, userId, userPhone);

  const { expiryDays } = await invitationConfigService.getConfig();
  await assertInvitationNotExpired(invitation, expiryDays);

  return invitation;
}

function buildListWhere(userId: string, userPhone: string, query: ListInvitationsQuery): Prisma.InvitationWhereInput {
  const recipientFilter: Prisma.InvitationWhereInput = {
    OR: [{ recipientUserId: userId }, { recipientPhone: userPhone, recipientUserId: null }],
  };

  const where: Prisma.InvitationWhereInput = {
    ...recipientFilter,
  };

  if (query.filter) {
    if (query.filter === 'history') {
      where.AND = [
        {
          status: { in: ['rejected', 'expired', 'canceled', 'validated', 'charged', 'failed'] },
        },
      ];
    } else {
      const statuses = mapListFilterToStatuses(query.filter);
      if (statuses) {
        where.status = { in: statuses };
      }
    }
  } else if (!query.status) {
    where.status = { in: ['sent', 'viewed', 'accepted'] };
  }

  if (query.status) {
    const statuses = query.status.split(',').map((s) => s.trim()) as Prisma.EnumInvitationStatusFilter['in'];
    where.status = { in: statuses };
  }

  if (query.tier) {
    where.tier = query.tier;
  }

  if (query.type) {
    if (query.type === 'courtesy') {
      where.type = 'guaranteed';
    } else if (query.type === 'discounted') {
      where.type = 'discount';
    } else if (query.type === 'vip' || query.type === 'vip_table') {
      where.type = 'free';
      where.tier = 'vip';
    } else {
      where.type = 'free';
    }
  }

  if (query.product_kind) {
    const kinds = query.product_kind.split(',').map((value) => value.trim());
    const typeFilters: Prisma.InvitationWhereInput[] = [];

    for (const kind of kinds) {
      if (kind === 'free') {
        typeFilters.push({ type: 'free' });
      } else if (kind === 'guaranteed_pass') {
        typeFilters.push({ type: 'guaranteed' });
      } else if (kind === 'discounted') {
        typeFilters.push({ type: 'discount' });
      }
    }

    if (typeFilters.length > 0) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: typeFilters }];
    }
  }

  if (query.source) {
    where.source = query.source;
  }

  if (query.event_type) {
    const eventTypeFilter: Prisma.InvitationWhereInput = {
      event: { eventType: { slug: query.event_type } },
    };
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      eventTypeFilter,
    ];
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

function sortInvitations<T extends { status: string; sentAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

export const invitationsService = {
  async listInvitations(userId: string, userPhone: string, query: ListInvitationsQuery) {
    await repairInvitationTimestamps(prisma);
    await purgeExpiredInvitationsForRecipient(userId, userPhone);

    const { expiryDays } = await invitationConfigService.getConfig();
    const invitations = await prisma.invitation.findMany({
      where: buildListWhere(userId, userPhone, query),
      include: invitationInclude,
    });

    const sorted = sortInvitations(invitations);
    const formatted = sorted.map((invitation) =>
      formatInvitationListItem(invitation, expiryDays),
    );

    const pendingCount = formatted.filter((i) => ['sent', 'viewed'].includes(i.status)).length;
    const confirmedCount = formatted.filter((i) => ['accepted', 'validated'].includes(i.status)).length;
    const waitlistEntries = await waitlistService.listUserWaitlistEntries(userId);

    return {
      invitations: formatted,
      waitlist_entries: waitlistEntries,
      meta: {
        total: formatted.length,
        pending_count: pendingCount + waitlistEntries.length,
        confirmed_count: confirmedCount,
        waitlist_count: waitlistEntries.length,
      },
    };
  },

  async getInvitationDetail(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);
    const { expiryDays } = await invitationConfigService.getConfig();

    if (invitation.status === 'sent') {
      await prisma.invitation.update({
        where: { id },
        data: { viewedAt: new Date(), status: 'viewed' },
      });
      invitation.status = 'viewed';
      invitation.viewedAt = new Date();
    } else if (!invitation.viewedAt) {
      await prisma.invitation.update({
        where: { id },
        data: { viewedAt: new Date() },
      });
      invitation.viewedAt = new Date();
    }

    return formatInvitationDetail(invitation, expiryDays);
  },

  async getSummary(userId: string, userPhone: string) {
    await purgeExpiredInvitationsForRecipient(userId, userPhone);

    const recipientFilter: Prisma.InvitationWhereInput = {
      OR: [{ recipientUserId: userId }, { recipientPhone: userPhone, recipientUserId: null }],
    };

    const [pending, total, newCount] = await Promise.all([
      prisma.invitation.count({
        where: { ...recipientFilter, status: { in: ['sent', 'viewed'] } },
      }),
      prisma.invitation.count({
        where: {
          ...recipientFilter,
          status: { in: ['sent', 'viewed', 'accepted'] },
        },
      }),
      prisma.invitation.count({
        where: {
          ...recipientFilter,
          // Unread = still in initial "sent" state (opening detail moves to "viewed").
          // Do not filter on viewedAt — on MongoDB, missing fields do not match `null`.
          status: 'sent',
        },
      }),
    ]);

    return {
      pending_count: pending,
      new_count: newCount,
      total_count: total,
    };
  },

  async getHomeInvitationHighlight(userId: string, userPhone: string) {
    const summary = await this.getSummary(userId, userPhone);
    if (summary.pending_count === 0) {
      return {
        highlight: false,
        pending_count: 0,
        featured: null,
      };
    }

    const { invitations } = await this.listInvitations(userId, userPhone, { filter: 'pending' });
    const featured = invitations[0] ?? null;

    return {
      highlight: true,
      pending_count: summary.pending_count,
      new_count: summary.new_count,
      featured,
    };
  },

  async getClaimPreview(token: string) {
    const invitation = await prisma.invitation.findFirst({
      where: { claimToken: token, source: 'guest', status: { in: ['sent', 'viewed'] } },
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

  async getInvitationStatus(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);
    const status = formatLifecycleStatus({
      ...invitation,
      ticket: invitation.ticket,
    });

    return {
      invitation_id: id,
      ...status,
      updated_at: invitation.updatedAt.toISOString(),
    };
  },

  async acceptInvitation(
    userId: string,
    userPhone: string,
    id: string,
    input: AcceptInvitationInput,
  ) {
    return this.confirmInvitation(userId, userPhone, id, input);
  },

  async confirmInvitation(userId: string, userPhone: string, id: string, input: ConfirmInvitationInput) {
    const invitation = await getInvitationForUser(id, userId, userPhone);
    const { expiryDays } = await invitationConfigService.getConfig();
    const productKind = resolveInvitationProductKind(invitation);

    if (invitation.status === 'accepted' || invitation.status === 'validated') {
      throw new AppError(409, 'INVITATION_ALREADY_CONFIRMED', 'Already confirmed');
    }

    if (!['sent', 'viewed'].includes(invitation.status)) {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    if (isInvitationExpired(invitation, expiryDays)) {
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

    if (productKind === 'guaranteed_pass') {
      if (
        termsAcceptedRequired(invitation.type, invitation.source, invitation.entryValue) &&
        !input.accept_charge_terms
      ) {
        throw new AppError(
          422,
          'TERMS_ACCEPTANCE_REQUIRED',
          'You must accept the Guaranteed Pass terms before confirming',
        );
      }

      const paymentMethod = await getDefaultPaymentMethod(userId, input.payment_method_id);
      const amount = invitation.entryValue;
      const currency = invitation.chargeCurrency ?? 'CLP';

      const preauth = await preauthorizeInvitationPayment({
        invitationId: id,
        userId,
        countryCode: invitation.event.countryCode,
        amount,
        currency,
        paymentMethodToken: paymentMethod.providerToken,
      });

      const timezone = getTimezone(invitation.event.countryCode);
      const unlockAt = eventDayStart(invitation.event.startsAt, timezone);
      const entryCode = generateEntryCode();
      const ticketId = crypto.randomBytes(12).toString('hex');
      const qrPayload = generateQrPayload(ticketId, invitation.eventId);

      const updated = await prisma.$transaction(async (tx) =>
        persistAcceptedInvitation(
          tx,
          invitation,
          id,
          userId,
          { ticketId, entryCode, qrPayload, unlockAt },
        ),
      );

      await invitationPreAuthService.createInvitationPreAuth({
        invitationId: id,
        userId,
        cardId: paymentMethod.id,
        amount,
        gateway: preauth.gateway,
        gatewayTransactionId: preauth.preauth_reference,
      });

      const contact = resolveGuestContact(updated.recipient, updated);
      await guaranteedPassNotificationService.sendAcceptanceConfirmation({
        invitation: updated,
        event: updated.event,
        producer: updated.producer,
        recipient: updated.recipient,
        inviterName: updated.producer.name,
        ...contact,
      });

      await invitationAuditService.log({
        invitationId: id,
        actorUserId: userId,
        actorType: 'guest',
        action: 'accept_invitation',
        result: 'success',
        metadata: { product_kind: 'guaranteed_pass' },
      });

      return formatInvitationListItem(updated, expiryDays);
    }

    if (productKind === 'discounted') {
      const paymentMethod = await getDefaultPaymentMethod(userId, input.payment_method_id);
      const amount = invitation.amountToPay;
      const currency = invitation.chargeCurrency ?? 'CLP';

      const payment = await chargeInvitationPayment({
        invitationId: id,
        userId,
        countryCode: invitation.event.countryCode,
        amount,
        currency,
        paymentMethodToken: paymentMethod.providerToken,
      });

      const timezone = getTimezone(invitation.event.countryCode);
      const unlockAt = eventDayStart(invitation.event.startsAt, timezone);
      const entryCode = generateEntryCode();
      const ticketId = crypto.randomBytes(12).toString('hex');
      const qrPayload = generateQrPayload(ticketId, invitation.eventId);

      const updated = await prisma.$transaction(async (tx) =>
        persistAcceptedInvitation(
          tx,
          invitation,
          id,
          userId,
          { ticketId, entryCode, qrPayload, unlockAt },
        ),
      );

      await invitationAuditService.log({
        invitationId: id,
        actorUserId: userId,
        actorType: 'guest',
        action: 'accept_invitation',
        result: 'success',
        metadata: { product_kind: 'discounted', amount, payment_reference: payment.payment_reference },
      });

      return formatInvitationListItem(updated, expiryDays);
    }

    // Type 1 — Free invitation (zero-value — card on file, no pre-auth charge)
    if (isZeroValueFreeInvitation(invitation)) {
      if (
        termsAcceptedRequired(invitation.type, invitation.source, invitation.entryValue) &&
        !input.accept_charge_terms
      ) {
        throw new AppError(
          422,
          'TERMS_ACCEPTANCE_REQUIRED',
          'You must accept the attendance terms before confirming',
        );
      }

      await getDefaultPaymentMethod(userId, input.payment_method_id);

      const timezone = getTimezone(invitation.event.countryCode);
      const unlockAt = eventDayStart(invitation.event.startsAt, timezone);
      const entryCode = generateEntryCode();
      const ticketId = crypto.randomBytes(12).toString('hex');
      const qrPayload = generateQrPayload(ticketId, invitation.eventId);

      const updated = await prisma.$transaction(async (tx) =>
        persistAcceptedInvitation(
          tx,
          invitation,
          id,
          userId,
          { ticketId, entryCode, qrPayload, unlockAt },
        ),
      );

      await invitationAuditService.log({
        invitationId: id,
        actorUserId: userId,
        actorType: 'guest',
        action: 'accept_invitation',
        result: 'success',
        metadata: { product_kind: 'free', zero_value: true },
      });

      return formatInvitationListItem(updated, expiryDays);
    }

    // Type 1 — Free invitation (producer courtesy with no-show pre-auth)
    if (isProducerFreeWithNoShowPolicy(invitation)) {
      if (
        termsAcceptedRequired(invitation.type, invitation.source, invitation.entryValue) &&
        !input.accept_charge_terms
      ) {
        throw new AppError(
          422,
          'TERMS_ACCEPTANCE_REQUIRED',
          'You must accept the attendance terms before confirming',
        );
      }

      const paymentMethod = await getDefaultPaymentMethod(userId, input.payment_method_id);
      const amount = invitation.entryValue;
      const currency = invitation.chargeCurrency ?? 'CLP';

      const preauth = await preauthorizeInvitationPayment({
        invitationId: id,
        userId,
        countryCode: invitation.event.countryCode,
        amount,
        currency,
        paymentMethodToken: paymentMethod.providerToken,
      });

      const timezone = getTimezone(invitation.event.countryCode);
      const unlockAt = eventDayStart(invitation.event.startsAt, timezone);
      const entryCode = generateEntryCode();
      const ticketId = crypto.randomBytes(12).toString('hex');
      const qrPayload = generateQrPayload(ticketId, invitation.eventId);

      const updated = await prisma.$transaction(async (tx) =>
        persistAcceptedInvitation(
          tx,
          invitation,
          id,
          userId,
          { ticketId, entryCode, qrPayload, unlockAt },
        ),
      );

      await invitationPreAuthService.createInvitationPreAuth({
        invitationId: id,
        userId,
        cardId: paymentMethod.id,
        amount,
        gateway: preauth.gateway,
        gatewayTransactionId: preauth.preauth_reference,
      });

      await invitationAuditService.log({
        invitationId: id,
        actorUserId: userId,
        actorType: 'guest',
        action: 'accept_invitation',
        result: 'success',
        metadata: { product_kind: 'free', no_show_preauth: true },
      });

      return formatInvitationListItem(updated, expiryDays);
    }

    // Type 1 — Free invitation (purchased guest assignment — no payment hold)
    const timezone = getTimezone(invitation.event.countryCode);
    const unlockAt = eventDayStart(invitation.event.startsAt, timezone);
    const entryCode = generateEntryCode();
    const ticketId = crypto.randomBytes(12).toString('hex');
    const qrPayload = generateQrPayload(ticketId, invitation.eventId);

    const updated = await prisma.$transaction(async (tx) =>
      persistAcceptedInvitation(
        tx,
        invitation,
        id,
        userId,
        { ticketId, entryCode, qrPayload, unlockAt },
      ),
    );

    await invitationAuditService.log({
      invitationId: id,
      actorUserId: userId,
      actorType: 'guest',
      action: 'accept_invitation',
      result: 'success',
      metadata: { product_kind: 'free' },
    });

    return formatInvitationListItem(updated, expiryDays);
  },

  async rejectInvitation(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);
    const { expiryDays } = await invitationConfigService.getConfig();

    if (invitation.status === 'accepted' || invitation.status === 'validated') {
      throw new AppError(409, 'INVITATION_ALREADY_CONFIRMED', 'Already confirmed');
    }

    if (!['sent', 'viewed'].includes(invitation.status)) {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    if (isInvitationExpired(invitation, expiryDays)) {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Response deadline passed');
    }

    await notifyInviterInvitationDeclined({
      inviterUserId: invitation.inviterUserId,
      recipientName: invitation.recipientName,
      eventTitle: invitation.event.title,
    });

    const freedSlotId = await prisma.$transaction(async (tx) =>
      deleteInvitationRecord(tx, invitation),
    );

    await triggerWaitlistForReleasedSlot(freedSlotId);

    await invitationAuditService.log({
      invitationId: id,
      actorUserId: userId,
      actorType: 'guest',
      action: 'reject_invitation',
      result: 'success',
    });

    return {
      deleted: true,
      invitation_id: id,
      message: 'Invitation declined',
    };
  },

  async cancelInvitation(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);
    const productKind = resolveInvitationProductKind(invitation);

    if (productKind !== 'guaranteed_pass') {
      throw new AppError(409, 'INVITATION_NOT_CANCELLABLE', 'Only Guaranteed Pass invitations can be cancelled here');
    }

    if (invitation.status !== 'accepted') {
      throw new AppError(409, 'INVITATION_NOT_CANCELLABLE', 'Only accepted passes can be cancelled');
    }

    const now = new Date();
    if (
      invitation.cancellationDeadline == null ||
      now > invitation.cancellationDeadline
    ) {
      throw new AppError(
        409,
        'CANCELLATION_DEADLINE_PASSED',
        'Cancellation deadline has passed',
      );
    }

    await releaseInvitationPreAuthHold(id);

    const contact = resolveGuestContact(invitation.recipient, invitation);

    const freedSlotId = await prisma.$transaction(async (tx) =>
      deleteInvitationRecord(tx, invitation),
    );

    await triggerWaitlistForReleasedSlot(freedSlotId);

    await guaranteedPassNotificationService.sendCancellationConfirmation({
      invitation,
      event: invitation.event,
      producer: invitation.producer,
      recipient: invitation.recipient,
      inviterName: invitation.producer.name,
      ...contact,
    });

    await guaranteedPassNotificationService.notifyPromoterSlotReleased({
      invitation,
      event: invitation.event,
      producer: invitation.producer,
      recipient: invitation.recipient,
      inviterName: invitation.producer.name,
      ...contact,
    });

    await invitationAuditService.log({
      invitationId: id,
      actorUserId: userId,
      actorType: 'guest',
      action: 'cancel_invitation',
      result: 'success',
      metadata: {
        cancellation_deadline: invitation.cancellationDeadline?.toISOString() ?? null,
      },
    });

    return {
      deleted: true,
      invitation_id: id,
      message: 'Your Guaranteed Pass was cancelled without charge.',
      cancellation_deadline: invitation.cancellationDeadline?.toISOString() ?? null,
    };
  },

  async getTicket(userId: string, userPhone: string, id: string) {
    const invitation = await getInvitationForUser(id, userId, userPhone);

    if (invitation.status !== 'accepted' || !invitation.ticket) {
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

function parseCardExpiry(expiry: string): { month: number; year: number } | null {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }

  return { month, year };
}

function resolveWalletCurrency(countryCode?: string | null): string {
  if (!countryCode) {
    return 'CLP';
  }
  return getCurrencyForCountry(countryCode);
}

function formatPaymentMethod(m: {
  id: string;
  providerToken: string;
  brand: string;
  lastFour: string;
  expirationMonth: number | null;
  expirationYear: number | null;
  cardholderName: string;
  isDefault: boolean;
  gateway: string | null;
}) {
  return {
    id: m.id,
    klap_card_token: m.providerToken,
    brand: m.brand,
    last_four: m.lastFour,
    expiration_month: m.expirationMonth,
    expiration_year: m.expirationYear,
    holder_name: m.cardholderName,
    is_default: m.isDefault,
    gateway: m.gateway ?? 'klap',
  };
}

export const paymentMethodsService = {
  allowsLegacyCardInput(): boolean {
    return (
      env.ALLOW_LEGACY_CARD_INPUT ||
      (env.NODE_ENV === 'development' && env.CHECKOUT_MOCK_PAYMENT)
    );
  },

  async listPaymentMethods(userId: string) {
    const methods = await prisma.userPaymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((m) => formatPaymentMethod(m));
  },

  async listWalletCards(userId: string) {
    const cards = await this.listPaymentMethods(userId);
    const balance = await this.getWalletBalance(userId);
    return { cards, balance };
  },

  async getWalletBalance(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true },
    });
    const currency = resolveWalletCurrency(user?.countryCode);
    return { credits: 0, currency };
  },

  async listWalletTransactions(userId: string) {
    const orders = await prisma.ticketOrder.findMany({
      where: {
        buyerUserId: userId,
        status: { in: ['paid', 'refunded', 'pending_payment'] },
      },
      include: {
        event: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      transactions: orders.map((order) => ({
        id: order.id,
        type: 'purchase',
        description: order.event.title,
        amount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        created_at: order.createdAt.toISOString(),
      })),
    };
  },

  async createWalletTokenizeSession(userId: string, apiOrigin?: string) {
    const sessionId = `tok_${crypto.randomBytes(12).toString('hex')}`;
    const apiBase = env.KLAP_TOKENIZATION_BASE_URL.trim();
    const tokenizationUrl = apiBase
      ? `${apiBase}${apiBase.includes('?') ? '&' : '?'}session=${sessionId}`
      : `${apiOrigin ?? ''}${env.API_PREFIX}/wallet/klap/mock-tokenize?session=${sessionId}&user=${userId}`;

    return {
      gateway: 'klap' as const,
      session_id: sessionId,
      tokenization_url: tokenizationUrl,
      success_redirect_scheme: 'youpass://wallet/tokenized',
    };
  },

  async deletePaymentMethod(userId: string, cardId: string) {
    const method = await prisma.userPaymentMethod.findFirst({
      where: {
        userId,
        OR: [{ id: cardId }, { providerToken: cardId }],
      },
    });

    if (!method) {
      throw new AppError(404, 'CARD_NOT_FOUND', 'Payment method not found');
    }

    if (method.isDefault) {
      const others = await prisma.userPaymentMethod.count({
        where: { userId, id: { not: method.id } },
      });
      if (others > 0) {
        throw new AppError(
          400,
          'DEFAULT_CARD_REQUIRED',
          'Choose a new default card before deleting the current default',
        );
      }
    }

    await prisma.userPaymentMethod.delete({ where: { id: method.id } });
    return { deleted: true, id: cardId };
  },

  async setDefaultPaymentMethod(userId: string, cardId: string) {
    const method = await prisma.userPaymentMethod.findFirst({
      where: {
        userId,
        OR: [{ id: cardId }, { providerToken: cardId }],
      },
    });

    if (!method) {
      throw new AppError(404, 'CARD_NOT_FOUND', 'Payment method not found');
    }

    await prisma.userPaymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await prisma.userPaymentMethod.update({
      where: { id: method.id },
      data: { isDefault: true },
    });

    return formatPaymentMethod(updated);
  },

  async savePaymentMethod(userId: string, input: SavePaymentMethodInput) {
    if ('payment_method_id' in input) {
      return this.saveTokenizedPaymentMethod(userId, input);
    }

    if (!paymentMethodsService.allowsLegacyCardInput()) {
      throw new AppError(
        400,
        'CARD_TOKENIZATION_REQUIRED',
        'Send a tokenized payment_method_id from Klap or Stripe. Raw card data is not accepted.',
      );
    }

    const lastFour = maskCardLastFour(input.card_number);
    const brand = detectCardBrand(input.card_number);
    const providerToken = `pm_${crypto.randomBytes(8).toString('hex')}`;
    const expiry = parseCardExpiry(input.expiry);

    await prisma.userPaymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    const created = await prisma.userPaymentMethod.create({
      data: {
        userId,
        providerToken,
        gateway: 'klap',
        brand,
        lastFour,
        expirationMonth: expiry?.month,
        expirationYear: expiry?.year,
        cardholderName: input.cardholder_name.trim(),
        isDefault: true,
      },
    });

    return formatPaymentMethod(created);
  },

  async saveTokenizedPaymentMethod(userId: string, input: TokenizedPaymentMethodInput) {
    const setAsDefault = input.set_as_default ?? true;

    if (setAsDefault) {
      await prisma.userPaymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await prisma.userPaymentMethod.create({
      data: {
        userId,
        providerToken: input.payment_method_id.trim(),
        gateway: input.gateway,
        brand: input.brand.trim(),
        lastFour: input.last_four,
        expirationMonth: input.expiration_month,
        expirationYear: input.expiration_year,
        cardholderName: input.cardholder_name.trim(),
        isDefault: setAsDefault,
      },
    });

    return formatPaymentMethod(created);
  },

  async hasDefaultPaymentMethod(userId: string): Promise<boolean> {
    return userHasPaymentMethod(userId);
  },
};
