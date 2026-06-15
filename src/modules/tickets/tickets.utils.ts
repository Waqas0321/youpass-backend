import type { Event, Invitation, InvitationTicket } from '@prisma/client';
import { resolveQrStatus } from '../invitations/invitations.utils.js';
import { getTimezone } from '../invitations/invitations.formatter.js';

export type TicketDisplayStatus = 'active' | 'validated' | 'expired' | 'cancelled' | 'refunded';

export type InvitationTicketRow = Invitation & {
  event: Event & { eventType: { slug: string; name: string } };
  producer: { id: string; name: string };
  ticket: InvitationTicket;
};

export function eventEndAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
}

export function isEventPast(startsAt: Date, now = new Date()): boolean {
  return now > eventEndAt(startsAt);
}

export function resolveTicketStatus(
  invitation: Invitation,
  event: Event,
  ticket: InvitationTicket | null,
  now = new Date(),
  orderStatus?: string | null,
): TicketDisplayStatus {
  if (invitation.status === 'canceled') {
    return orderStatus === 'refunded' ? 'refunded' : 'cancelled';
  }
  if (event.status === 'cancelled') return 'cancelled';
  if (!ticket) return 'cancelled';
  if (ticket.validatedAt || invitation.status === 'validated') return 'validated';
  if (isEventPast(event.startsAt, now)) return 'expired';
  return 'active';
}

export function eventStillActiveCutoff(now = new Date()): Date {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

export function defaultCancellationDeadline(eventStartsAt: Date): Date {
  return new Date(eventStartsAt.getTime() - 2 * 24 * 60 * 60 * 1000);
}

export function canCancelTicket(
  invitation: Invitation,
  event: Event,
  now = new Date(),
): boolean {
  if (invitation.status !== 'accepted') return false;
  if (event.status === 'cancelled') return false;
  if (now >= event.startsAt) return false;

  const deadline =
    invitation.cancellationDeadline ?? defaultCancellationDeadline(event.startsAt);
  return now <= deadline;
}

export function isUpcomingTicket(row: InvitationTicketRow, now = new Date()): boolean {
  const status = resolveTicketStatus(row, row.event, row.ticket, now);
  if (status === 'cancelled' || status === 'expired') return false;
  if (status === 'active') return true;
  // Validated tickets stay in upcoming until the event window ends
  return !isEventPast(row.event.startsAt, now);
}

export function isPastTicket(
  row: InvitationTicketRow,
  now = new Date(),
  orderStatus?: string | null,
): boolean {
  if (row.status === 'canceled') {
    return true;
  }

  const status = resolveTicketStatus(row, row.event, row.ticket, now, orderStatus);
  if (
    status === 'cancelled' ||
    status === 'refunded' ||
    status === 'expired' ||
    status === 'validated'
  ) {
    return true;
  }

  return isEventPast(row.event.startsAt, now);
}

export function formatStayLabel(stayMinutes: number): string {
  const hours = Math.floor(stayMinutes / 60);
  const minutes = stayMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatEntryTime(date: Date, countryCode: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: getTimezone(countryCode),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function ticketTypeLabel(tier: Invitation['tier'], type: Invitation['type']): string {
  if (tier === 'vip' || type === 'guaranteed') return 'VIP';
  return 'General';
}

export function canViewQr(
  row: InvitationTicketRow,
  now = new Date(),
): boolean {
  const qrStatus = resolveQrStatus(
    row.ticket.unlockAt,
    row.ticket.validatedAt,
    row.event.startsAt,
  );
  return qrStatus === 'available' && resolveTicketStatus(row, row.event, row.ticket, now) !== 'cancelled';
}
