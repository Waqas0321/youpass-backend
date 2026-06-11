import type { Event, Invitation, InvitationTicket, Producer, User } from '@prisma/client';
import {
  formatDateTimeLabel,
  formatDeadlineLabel,
  resolveQrStatus,
  type QrStatus,
} from './invitations.utils.js';

type InvitationWithRelations = Invitation & {
  event: Event;
  producer: Producer;
  ticket: InvitationTicket | null;
  inviter?: User | null;
};

function locationLabel(event: Event): string {
  return `${event.venueName}, ${event.city}`;
}

import { getTimezone } from '../../common/services/country-config.service.js';

export { getTimezone };

function mapStatusForApi(status: Invitation['status']): string {
  return status === 'canceled' ? 'rejected' : status;
}

function qrFields(invitation: InvitationWithRelations): { entry_code: string | null; qr_payload: string | null; qr_status: QrStatus } {
  if (invitation.status !== 'confirmed' || !invitation.ticket) {
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

function baseFields(invitation: InvitationWithRelations, timezone: string) {
  const qr = qrFields(invitation);

  return {
    id: invitation.id,
    event_id: invitation.eventId,
    event_title: invitation.event.title,
    location: locationLabel(invitation.event),
    date_time_label: formatDateTimeLabel(invitation.event.startsAt, timezone),
    image_url: invitation.event.imageUrl,
    tier: invitation.tier,
    type: invitation.type,
    source: invitation.source,
    status: mapStatusForApi(invitation.status),
    requires_payment_method: invitation.requiresPaymentMethod,
    entry_code: qr.entry_code,
    qr_payload: qr.qr_payload,
    qr_status: qr.qr_status,
  };
}

function computeFlags(invitation: InvitationWithRelations, hasPaymentMethod: boolean) {
  const now = new Date();
  const qr = qrFields(invitation);
  const isPending = invitation.status === 'pending';
  const isConfirmed = invitation.status === 'confirmed';
  const pastDeadline =
    invitation.cancellationDeadline != null && now > invitation.cancellationDeadline;

  return {
    can_confirm:
      isPending &&
      !pastDeadline &&
      invitation.event.status === 'published' &&
      (!invitation.requiresPaymentMethod || hasPaymentMethod),
    can_reject: isPending && !pastDeadline,
    can_cancel:
      isConfirmed &&
      invitation.cancellationDeadline != null &&
      now <= invitation.cancellationDeadline,
    can_view_qr: isConfirmed && qr.qr_status === 'available',
  };
}

export function formatInvitationListItem(invitation: InvitationWithRelations) {
  const timezone = getTimezone(invitation.event.countryCode);
  return baseFields(invitation, timezone);
}

export function formatInvitationDetail(
  invitation: InvitationWithRelations,
  hasPaymentMethod: boolean,
) {
  const timezone = getTimezone(invitation.event.countryCode);
  const flags = computeFlags(invitation, hasPaymentMethod);

  return {
    ...baseFields(invitation, timezone),
    terms_accepted_required: invitation.termsAcceptedRequired,
    ...flags,
    producer: {
      id: invitation.producer.id,
      name: invitation.producer.name,
      logo_url: invitation.producer.logoUrl,
    },
    invited_by:
      invitation.source === 'guest' && invitation.inviter
        ? {
            name: invitation.inviter.fullName,
            role: 'guest' as const,
          }
        : {
            name: invitation.producer.name,
            role: 'producer' as const,
          },
    custom_message: invitation.customMessage,
    assigned_slot: invitation.assignedSlot,
    cancellation_deadline: invitation.cancellationDeadline?.toISOString() ?? null,
    cancellation_deadline_label: invitation.cancellationDeadline
      ? formatDeadlineLabel(invitation.cancellationDeadline, timezone)
      : null,
    charge_amount: invitation.chargeAmount,
    charge_currency: invitation.chargeCurrency ?? 'CLP',
    sent_at: invitation.sentAt.toISOString(),
    responded_at: invitation.respondedAt?.toISOString() ?? null,
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
