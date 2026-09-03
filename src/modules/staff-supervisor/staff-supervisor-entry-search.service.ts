import { prisma } from '../../config/database.js';
import type { Invitation, InvitationTicket, Prisma } from '@prisma/client';
import { isMongoObjectId } from '../../common/utils/mongo-id.js';
import { getTimezone } from '../../common/services/country-config.service.js';
import { findInvitationTicketByScanInput } from '../invitations/invitation-ticket-scan.utils.js';
import type { StaffSupervisorSearchEntriesQuery } from './staff-supervisor.validators.js';

type TicketWithInvitation = InvitationTicket & {
  invitation: Invitation & {
    event: { id: string; title: string; countryCode: string; startsAt: Date };
    recipient: { fullName: string; email: string | null; rutOrPassport: string | null } | null;
  };
};

const ticketSearchInclude = {
  invitation: {
    include: {
      event: {
        select: {
          id: true,
          title: true,
          countryCode: true,
          startsAt: true,
        },
      },
      recipient: {
        select: { fullName: true, email: true, rutOrPassport: true },
      },
    },
  },
} as const;

const ERROR_INVITATION_STATUSES = ['rejected', 'expired', 'canceled', 'failed'] as const;

function normalizeManualEntryCode(value: string) {
  return value.trim().toUpperCase();
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

function activeEventWindow(): Prisma.EventWhereInput {
  const now = Date.now();
  return {
    startsAt: {
      gte: new Date(now - 24 * 60 * 60 * 1000),
      lte: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
  };
}

function buildInvitationFilter(
  query: StaffSupervisorSearchEntriesQuery,
  options?: { restrictToActiveEvents?: boolean },
): Prisma.InvitationWhereInput {
  const invitationWhere: Prisma.InvitationWhereInput = {
    ticket: { isNot: null },
    status: { in: ['accepted', 'validated', ...ERROR_INVITATION_STATUSES] },
  };

  if (query.event_id) {
    invitationWhere.eventId = query.event_id;
  } else if (options?.restrictToActiveEvents !== false) {
    invitationWhere.event = activeEventWindow();
  }

  if (query.filter === 'vip') {
    invitationWhere.tier = 'vip';
  }

  if (query.filter === 'used' || query.filter === 'duplicate') {
    invitationWhere.OR = [
      { status: 'validated' },
      { ticket: { is: { validatedAt: { not: null } } } },
    ];
  }

  if (query.filter === 'error') {
    invitationWhere.status = { in: [...ERROR_INVITATION_STATUSES] };
  }

  return invitationWhere;
}

function withInvitationSearch(
  invitationWhere: Prisma.InvitationWhereInput,
  searchWhere: Prisma.InvitationWhereInput,
): Prisma.InvitationWhereInput {
  return {
    AND: [invitationWhere, searchWhere],
  };
}

function matchesQueryFilter(
  ticket: TicketWithInvitation,
  query: StaffSupervisorSearchEntriesQuery,
) {
  if (query.filter === 'vip' && ticket.invitation.tier !== 'vip') {
    return false;
  }

  if (query.filter === 'used' && !ticket.validatedAt && ticket.invitation.status !== 'validated') {
    return false;
  }

  if (
    query.filter === 'duplicate' &&
    (!ticket.validatedAt && ticket.invitation.status !== 'validated')
  ) {
    return false;
  }

  if (
    query.filter === 'error' &&
    !ERROR_INVITATION_STATUSES.includes(
      ticket.invitation.status as (typeof ERROR_INVITATION_STATUSES)[number],
    )
  ) {
    return false;
  }

  if (query.event_id && ticket.invitation.eventId !== query.event_id) {
    return false;
  }

  return true;
}

function buildGuestSearchOr(term: string): Prisma.InvitationWhereInput[] {
  const digits = phoneDigits(term);
  const guestOr: Prisma.InvitationWhereInput[] = [
    { recipientName: { contains: term, mode: 'insensitive' } },
    { assignedSlot: { contains: term, mode: 'insensitive' } },
    { recipient: { is: { fullName: { contains: term, mode: 'insensitive' } } } },
    { recipient: { is: { email: { contains: term, mode: 'insensitive' } } } },
    { recipient: { is: { rutOrPassport: { contains: term, mode: 'insensitive' } } } },
    { event: { is: { title: { contains: term, mode: 'insensitive' } } } },
    { event: { is: { venueName: { contains: term, mode: 'insensitive' } } } },
  ];

  if (digits.length >= 4) {
    guestOr.push({ recipientPhone: { contains: digits } });
  }

  return guestOr;
}

async function searchByGuestTerm(
  term: string,
  query: StaffSupervisorSearchEntriesQuery,
  restrictToActiveEvents = true,
): Promise<TicketWithInvitation[]> {
  return prisma.invitationTicket.findMany({
    where: {
      invitation: withInvitationSearch(buildInvitationFilter(query, { restrictToActiveEvents }), {
        OR: buildGuestSearchOr(term),
      }),
    },
    include: ticketSearchInclude,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
}

async function searchByTicketIdentifiers(
  term: string,
  query: StaffSupervisorSearchEntriesQuery,
  restrictToActiveEvents = true,
): Promise<TicketWithInvitation[]> {
  const invitationWhere = buildInvitationFilter(query, { restrictToActiveEvents });
  const normalizedCode = normalizeManualEntryCode(term);
  const ticketOr: Prisma.InvitationTicketWhereInput[] = [
    { manualEntryId: normalizedCode },
    { qrPayload: term },
    { manualEntryId: { contains: normalizedCode, mode: 'insensitive' } },
  ];

  if (isMongoObjectId(term)) {
    ticketOr.push({ id: term });
  }

  return prisma.invitationTicket.findMany({
    where: {
      invitation: invitationWhere,
      OR: ticketOr,
    },
    include: ticketSearchInclude,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
}

async function searchByOrderReference(
  term: string,
  query: StaffSupervisorSearchEntriesQuery,
  restrictToActiveEvents = true,
): Promise<TicketWithInvitation[]> {
  const orderOr: Prisma.TicketOrderWhereInput[] = [
    { paymentReference: { contains: term, mode: 'insensitive' } },
  ];

  if (isMongoObjectId(term)) {
    orderOr.unshift({ id: term });
  }

  const orders = await prisma.ticketOrder.findMany({
    where: {
      status: 'paid',
      OR: orderOr,
      ...(query.event_id ? { eventId: query.event_id } : {}),
    },
    include: { slots: true },
    take: 5,
  });

  const invitationIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.slots.map((slot) => slot.invitationId).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  if (invitationIds.length === 0) {
    return [];
  }

  return prisma.invitationTicket.findMany({
    where: {
      invitationId: { in: invitationIds },
      invitation: buildInvitationFilter(query, { restrictToActiveEvents }),
    },
    include: ticketSearchInclude,
    take: 20,
  });
}

async function searchByVipTableLabel(
  term: string,
  query: StaffSupervisorSearchEntriesQuery,
  restrictToActiveEvents = true,
): Promise<TicketWithInvitation[]> {
  const tables = await prisma.venueTable.findMany({
    where: {
      label: { contains: term, mode: 'insensitive' },
      ...(query.event_id ? { eventId: query.event_id } : {}),
    },
    select: { id: true },
    take: 10,
  });

  if (tables.length === 0) {
    return [];
  }

  const orders = await prisma.ticketOrder.findMany({
    where: {
      status: 'paid',
      venueTableId: { in: tables.map((table) => table.id) },
    },
    include: { slots: true },
    take: 10,
  });

  const invitationIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.slots.map((slot) => slot.invitationId).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  if (invitationIds.length === 0) {
    return [];
  }

  return prisma.invitationTicket.findMany({
    where: {
      invitationId: { in: invitationIds },
      invitation: buildInvitationFilter(query, { restrictToActiveEvents }),
    },
    include: ticketSearchInclude,
    take: 20,
  });
}

async function searchByFilterOnly(
  query: StaffSupervisorSearchEntriesQuery,
  restrictToActiveEvents = true,
): Promise<TicketWithInvitation[]> {
  return prisma.invitationTicket.findMany({
    where: {
      invitation: buildInvitationFilter(query, { restrictToActiveEvents }),
    },
    include: ticketSearchInclude,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
}

function mergeTickets(...groups: TicketWithInvitation[][]) {
  const merged = new Map<string, TicketWithInvitation>();
  for (const group of groups) {
    for (const ticket of group) {
      merged.set(ticket.id, ticket);
    }
  }
  return [...merged.values()];
}

async function filterTicketsWithDuplicateAttempts(tickets: TicketWithInvitation[]) {
  if (tickets.length === 0) {
    return [];
  }

  const entryIds = tickets.map((ticket) => ticket.manualEntryId);
  const duplicateLogs = await prisma.staffScanLog.findMany({
    where: {
      entryId: { in: entryIds },
      scanType: 'entry',
      outcome: 'already_used',
    },
    select: { entryId: true },
    distinct: ['entryId'],
  });

  const duplicateEntryIds = new Set(
    duplicateLogs.map((log) => log.entryId).filter((entryId): entryId is string => Boolean(entryId)),
  );

  return tickets.filter((ticket) => duplicateEntryIds.has(ticket.manualEntryId));
}

export async function searchSupervisorEntries(query: StaffSupervisorSearchEntriesQuery) {
  const term = query.q?.trim() ?? '';
  const restrictToActiveEvents = term.length === 0 && !query.event_id;

  if (!term && query.filter) {
    return searchByFilterOnly(query, restrictToActiveEvents);
  }

  const tasks: Promise<TicketWithInvitation[]>[] = [
    searchByGuestTerm(term, query, restrictToActiveEvents),
    searchByTicketIdentifiers(term, query, restrictToActiveEvents),
  ];

  if (term.length >= 4) {
    tasks.push(
      findInvitationTicketByScanInput(term).then((direct) => {
        if (!direct) {
          return [];
        }

        const ticket = direct as TicketWithInvitation;
        return matchesQueryFilter(ticket, query) ? [ticket] : [];
      }),
    );
  }

  if (term.length >= 3) {
    tasks.push(
      searchByOrderReference(term, query, restrictToActiveEvents),
      searchByVipTableLabel(term, query, restrictToActiveEvents),
    );
  }

  const groups = await Promise.all(tasks);
  let results = mergeTickets(...groups);

  if (query.filter === 'duplicate') {
    results = await filterTicketsWithDuplicateAttempts(results);
  }

  return results.slice(0, 20);
}

export function resolveEntryStatus(ticket: TicketWithInvitation) {
  if (
    ERROR_INVITATION_STATUSES.includes(
      ticket.invitation.status as (typeof ERROR_INVITATION_STATUSES)[number],
    )
  ) {
    return 'error' as const;
  }

  if (ticket.validatedAt || ticket.invitation.status === 'validated') {
    return 'used' as const;
  }

  return 'pending' as const;
}

export function buildVipTags(invitation: TicketWithInvitation['invitation']) {
  const tags = new Set<string>();

  if (invitation.tier === 'vip') {
    tags.add('VIP');
  }

  if (invitation.assignedSlot.trim()) {
    tags.add(invitation.assignedSlot);
  }

  return [...tags];
}

export function formatPurchaseId(order: { id: string; paymentReference: string | null } | null) {
  if (!order) {
    return null;
  }

  if (order.paymentReference?.trim()) {
    return order.paymentReference;
  }

  return `ORD-${order.id.slice(-6).toUpperCase()}`;
}

export function formatTimeLabel(date: Date, countryCode: string) {
  const timezone = getTimezone(countryCode);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export { ticketSearchInclude };
export type { TicketWithInvitation };
