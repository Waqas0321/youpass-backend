import type { Event, Invitation, InvitationTicket, Producer, User } from '@prisma/client';
import {
  formatDateTimeLabel,
  formatDeadlineLabel,
  resolveQrStatus,
  type QrStatus,
} from './invitations.utils.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';
import {
  productKindFields,
  requiresPaymentMethod,
  resolveInvitationProductKind,
  termsAcceptedRequired,
} from './invitation-product-type.utils.js';
import { buildInvitationDeepLink } from './guaranteed-pass-deep-link.utils.js';
import {
  formatLifecycleStatus,
  mapApiStatus,
  mapDbTypeToApi,
  resolveInvitationLifecycleState,
} from './invitation-status.utils.js';

type InvitationWithRelations = Invitation & {
  event: Event;
  producer: Producer;
  ticket: InvitationTicket | null;
  inviter?: User | null;
  preAuth?: { status: string } | null;
};

function locationLabel(event: Event): string {
  return `${event.venueName}, ${event.city}`;
}

import { getTimezone } from '../../common/services/country-config.service.js';

export { getTimezone };

function statusLabel(
  invitation: InvitationWithRelations,
  productKind: ReturnType<typeof resolveInvitationProductKind>,
): string | null {
  if (productKind !== 'guaranteed_pass') {
    return null;
  }

  if (invitation.status === 'sent' || invitation.status === 'viewed') {
    return 'Awaiting acceptance';
  }

  if (invitation.status === 'accepted' || invitation.status === 'validated') {
    return 'Pass reserved';
  }

  return null;
}

function qrFields(invitation: InvitationWithRelations): { entry_code: string | null; qr_payload: string | null; qr_status: QrStatus } {
  if (invitation.status !== 'accepted' || !invitation.ticket) {
    return { entry_code: null, qr_payload: null, qr_status: 'locked' };
  }

  const qrStatus = resolveQrStatus(
    invitation.ticket.unlockAt,
    invitation.ticket.validatedAt,
    invitation.event.startsAt,
  );

  return {
    entry_code: invitation.ticket.manualEntryId,
    qr_payload: qrStatus === 'available' ? invitation.ticket.qrPayload : null,
    qr_status: qrStatus,
  };
}

function formatInvitedBy(invitation: InvitationWithRelations) {
  if (invitation.source === 'guest' && invitation.inviter) {
    return {
      name: invitation.inviter.fullName,
      role: 'guest' as const,
    };
  }

  return {
    name: invitation.producer.name,
    role: 'producer' as const,
  };
}

function pricingFields(invitation: InvitationWithRelations) {
  const productKind = resolveInvitationProductKind(invitation);
  const currency = invitation.chargeCurrency ?? 'CLP';
  const entryValue = invitation.entryValue;
  const acceptAmount = invitation.amountToPay;
  const noShowChargeAmount = productKind === 'guaranteed_pass' ? entryValue : null;

  return {
    ...productKindFields(invitation),
    entry_value: entryValue,
    amount_to_pay: acceptAmount,
    charge_amount: entryValue,
    charge_currency: currency,
    discount_percentage: invitation.discountPercentage,
    discount_percent: invitation.discountPercentage,
    accept_amount: acceptAmount,
    accept_amount_label:
      acceptAmount > 0 ? `${currency} ${Math.round(acceptAmount).toLocaleString('en')}` : null,
    no_show_charge_amount: noShowChargeAmount,
    no_show_charge_label:
      noShowChargeAmount != null && noShowChargeAmount > 0
        ? `${currency} ${Math.round(noShowChargeAmount).toLocaleString('en')}`
        : null,
    custom_message: invitation.customMessage,
    cancellation_deadline: invitation.cancellationDeadline.toISOString(),
    cancellation_deadline_label: formatDeadlineLabel(
      invitation.cancellationDeadline,
      getTimezone(invitation.event.countryCode),
    ),
  };
}

function baseFields(
  invitation: InvitationWithRelations,
  timezone: string,
  expiryDays: number,
) {
  const qr = qrFields(invitation);
  const expiresAt = invitationConfigService.resolveExpiresAt(invitation, expiryDays);
  const productKind = resolveInvitationProductKind(invitation);
  const lifecycle = resolveInvitationLifecycleState({
    status: invitation.status,
    viewedAt: invitation.viewedAt,
    ticket: invitation.ticket,
  });

  return {
    id: invitation.id,
    event_id: invitation.eventId,
    event_title: invitation.event.title,
    location: locationLabel(invitation.event),
    date_time_label: formatDateTimeLabel(invitation.event.startsAt, timezone),
    image_url: invitation.event.imageUrl,
    tier: invitation.tier,
    type: mapDbTypeToApi(invitation.type),
    source: invitation.source,
    status: mapApiStatus(invitation.status),
    lifecycle_state: lifecycle,
    status_label: statusLabel(invitation, productKind),
    deep_link: buildInvitationDeepLink(invitation.id),
    requires_payment_method: requiresPaymentMethod(invitation.type),
    terms_accepted_required: termsAcceptedRequired(invitation.type),
    entry_code: qr.entry_code,
    qr_payload: qr.qr_payload,
    qr_status: qr.qr_status,
    expires_at: expiresAt.toISOString(),
    expires_at_label: formatDeadlineLabel(expiresAt, timezone),
    invited_by: formatInvitedBy(invitation),
    assigned_slot: invitation.assignedSlot,
    ...pricingFields(invitation),
  };
}

function computeFlags(
  invitation: InvitationWithRelations,
  hasPaymentMethod: boolean,
  expiryDays: number,
) {
  const now = new Date();
  const qr = qrFields(invitation);
  const isPending = invitation.status === 'sent' || invitation.status === 'viewed';
  const isAccepted = invitation.status === 'accepted';
  const needsPaymentMethod = requiresPaymentMethod(invitation.type);
  const pastDeadline = now > invitation.cancellationDeadline;
  const pastExpiry =
    isPending &&
    invitationConfigService.resolveExpiresAt(invitation, expiryDays) <= now;

  return {
    can_confirm:
      isPending &&
      !pastDeadline &&
      !pastExpiry &&
      invitation.event.status === 'published' &&
      (!needsPaymentMethod || hasPaymentMethod),
    can_reject: isPending && !pastDeadline && !pastExpiry,
    can_cancel:
      isAccepted &&
      now <= invitation.cancellationDeadline,
    can_view_qr: isAccepted && qr.qr_status === 'available',
  };
}

export function formatInvitationListItem(
  invitation: InvitationWithRelations,
  expiryDays: number,
) {
  const timezone = getTimezone(invitation.event.countryCode);
  return baseFields(invitation, timezone, expiryDays);
}

export function formatInvitationDetail(
  invitation: InvitationWithRelations,
  hasPaymentMethod: boolean,
  expiryDays: number,
) {
  const timezone = getTimezone(invitation.event.countryCode);
  const flags = computeFlags(invitation, hasPaymentMethod, expiryDays);

  return {
    ...baseFields(invitation, timezone, expiryDays),
    ...flags,
    ...formatLifecycleStatus({
      status: invitation.status,
      viewedAt: invitation.viewedAt,
      ticket: invitation.ticket,
      preAuth: invitation.preAuth,
    }),
    producer: {
      id: invitation.producer.id,
      name: invitation.producer.name,
      logo_url: invitation.producer.logoUrl,
    },
    sent_at: invitation.sentAt.toISOString(),
    viewed_at: invitation.viewedAt?.toISOString() ?? null,
    responded_at: invitation.respondedAt?.toISOString() ?? null,
    canceled_at: invitation.canceledAt?.toISOString() ?? null,
    preauth_active: invitation.preAuth?.status === 'pre_authorized',
    payment_completed: invitation.status === 'charged' || invitation.amountToPay > 0 && invitation.status === 'accepted' && invitation.type === 'discount',
  };
}

export function formatInvitationTicket(
  invitation: InvitationWithRelations,
  timezone: string,
) {
  const ticket = invitation.ticket!;
  const qrStatus = resolveQrStatus(
    ticket.unlockAt,
    ticket.validatedAt,
    invitation.event.startsAt,
  );

  return {
    invitation_id: invitation.id,
    event_title: invitation.event.title,
    date_time_label: formatDateTimeLabel(invitation.event.startsAt, timezone),
    location: locationLabel(invitation.event),
    entry_code: ticket.manualEntryId,
    qr_payload: ticket.qrPayload,
    qr_status: qrStatus,
    ticket_type_label: invitation.tier.toUpperCase(),
    instruction: 'Show this code at the entrance to access the event',
  };
}
