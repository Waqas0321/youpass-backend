import type { InvitationTicketRow, TicketDisplayStatus } from './tickets.utils.js';
import {
  canViewQr,
  formatEntryTime,
  formatStayLabel,
  resolveTicketStatus,
  ticketTypeLabel,
} from './tickets.utils.js';
import { formatDateTimeLabel } from '../invitations/invitations.utils.js';
import { getTimezone } from '../invitations/invitations.formatter.js';
import { resolveQrStatus } from '../invitations/invitations.utils.js';

function locationLabel(event: InvitationTicketRow['event']): string {
  return `${event.venueName}, ${event.city}`;
}

function dateTimeCardLabel(event: InvitationTicketRow['event']): string {
  const timezone = getTimezone(event.countryCode);
  const formatted = formatDateTimeLabel(event.startsAt, timezone);
  return formatted.replace(' ·', ' •');
}

function formatStatistics(row: InvitationTicketRow, status: TicketDisplayStatus) {
  if (status !== 'validated' || !row.ticket.validatedAt) return null;

  const entryAt = row.ticket.validatedAt;
  const consumption = row.ticket.consumptionCount ?? null;
  const stayMinutes = row.ticket.stayMinutes ?? null;

  if (consumption == null && stayMinutes == null) {
    return {
      entry_time: formatEntryTime(entryAt, row.event.countryCode),
      entry_at: entryAt.toISOString(),
      consumption_count: null,
      stay_minutes: null,
      stay_label: null,
    };
  }

  return {
    entry_time: formatEntryTime(entryAt, row.event.countryCode),
    entry_at: entryAt.toISOString(),
    consumption_count: consumption,
    stay_minutes: stayMinutes,
    stay_label: stayMinutes != null ? formatStayLabel(stayMinutes) : null,
  };
}

type AssignMeta = {
  order_id: string;
  available_count: number;
};

function baseTicketFields(
  row: InvitationTicketRow,
  isFavorite: boolean,
  status: TicketDisplayStatus,
  assignMeta?: AssignMeta | null,
) {
  const typeLabel = ticketTypeLabel(row.tier, row.type);
  const qrStatus = resolveQrStatus(
    row.ticket.unlockAt,
    row.ticket.validatedAt,
    row.event.startsAt,
  );

  return {
    id: row.id,
    event_id: row.eventId,
    event_title: row.event.title,
    location: locationLabel(row.event),
    date_time_label: dateTimeCardLabel(row.event),
    image_url: row.event.imageUrl,
    status,
    ticket_type_label: typeLabel,
    ticket_count: 1,
    tier: row.tier,
    type: row.type,
    origin: row.source === 'guest' && assignMeta ? ('purchase' as const) : ('invitation' as const),
    source: row.source,
    invitation_id: row.id,
    ticket_order_id: assignMeta?.order_id ?? null,
    assignable_count: assignMeta?.available_count ?? 0,
    producer: {
      id: row.producer.id,
      name: row.producer.name,
    },
    event_type: {
      slug: row.event.eventType.slug,
      name: row.event.eventType.name,
    },
    assigned_slot: row.assignedSlot,
    is_favorite: isFavorite,
    can_view_qr: canViewQr(row),
    can_assign_tickets: (assignMeta?.available_count ?? 0) > 0,
    qr_status: qrStatus,
    entry_code: row.ticket.manualEntryId,
    statistics: formatStatistics(row, status),
  };
}

export function formatUpcomingTicket(
  row: InvitationTicketRow,
  isFavorite: boolean,
  assignMeta?: AssignMeta | null,
) {
  const status = resolveTicketStatus(row, row.event, row.ticket);
  return baseTicketFields(row, isFavorite, status, assignMeta);
}

export function formatPastTicket(
  row: InvitationTicketRow,
  isFavorite: boolean,
  assignMeta?: AssignMeta | null,
) {
  const status = resolveTicketStatus(row, row.event, row.ticket);
  return baseTicketFields(row, isFavorite, status, assignMeta);
}

export function formatTicketDetail(
  row: InvitationTicketRow,
  isFavorite: boolean,
  assignMeta?: AssignMeta | null,
) {
  const status = resolveTicketStatus(row, row.event, row.ticket);

  return {
    ...baseTicketFields(row, isFavorite, status, assignMeta),
    event_description: row.event.description,
    starts_at: row.event.startsAt.toISOString(),
    venue_name: row.event.venueName,
    city: row.event.city,
    country_code: row.event.countryCode,
    validated_at: row.ticket.validatedAt?.toISOString() ?? null,
    responded_at: row.respondedAt?.toISOString() ?? null,
    sent_at: row.sentAt.toISOString(),
  };
}
