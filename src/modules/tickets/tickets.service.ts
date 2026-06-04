import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { invitationsService } from '../invitations/invitations.service.js';
import { formatPastTicket, formatTicketDetail, formatUpcomingTicket } from './tickets.formatter.js';
import type { InvitationTicketRow } from './tickets.utils.js';
import { isPastTicket, isUpcomingTicket, resolveTicketStatus } from './tickets.utils.js';
import type { ListPastTicketsQuery, ListUpcomingTicketsQuery } from './tickets.validators.js';

const ticketInclude = {
  event: { include: { eventType: true } },
  producer: true,
  ticket: true,
} as const;

async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const favorites = await prisma.eventFavorite.findMany({
    where: { userId },
    select: { eventId: true },
  });
  return new Set(favorites.map((f) => f.eventId));
}

async function fetchTicketRows(userId: string): Promise<InvitationTicketRow[]> {
  const rows = await prisma.invitation.findMany({
    where: {
      recipientUserId: userId,
      status: { in: ['confirmed', 'validated'] },
      ticket: { isNot: null },
    },
    include: ticketInclude,
    orderBy: { event: { startsAt: 'asc' } },
  });

  return rows as InvitationTicketRow[];
}

function matchesSearch(row: InvitationTicketRow, term: string): boolean {
  const haystack = [
    row.event.title,
    row.event.venueName,
    row.event.city,
    row.producer.name,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function filterPastRows(rows: InvitationTicketRow[], query: ListPastTicketsQuery): InvitationTicketRow[] {
  const now = new Date();

  return rows.filter((row) => {
    if (!isPastTicket(row, now)) return false;

    if (query.event_type && row.event.eventType.slug !== query.event_type) return false;

    if (query.search && !matchesSearch(row, query.search.trim())) return false;

    const status = resolveTicketStatus(row, row.event, row.ticket, now);
    if (query.status === 'attended' && status !== 'validated') return false;
    if (query.status === 'not_attended' && status !== 'expired') return false;
    if (query.status === 'cancelled' && status !== 'cancelled') return false;

    return true;
  });
}

function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    meta: {
      total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getTicketRowForUser(userId: string, ticketId: string): Promise<InvitationTicketRow> {
  const row = await prisma.invitation.findFirst({
    where: {
      id: ticketId,
      recipientUserId: userId,
      status: { in: ['confirmed', 'validated'] },
      ticket: { isNot: null },
    },
    include: ticketInclude,
  });

  if (!row || !row.ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
  }

  return row as InvitationTicketRow;
}

export const ticketsService = {
  async listUpcoming(userId: string, query: ListUpcomingTicketsQuery) {
    const favoriteIds = await getFavoriteIds(userId);
    const now = new Date();
    const upcoming = (await fetchTicketRows(userId))
      .filter((row) => isUpcomingTicket(row, now))
      .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());

    const { items, meta } = paginate(upcoming, query.page, query.limit);

    return {
      tickets: items.map((row) => formatUpcomingTicket(row, favoriteIds.has(row.eventId))),
      meta: {
        ...meta,
        active_count: upcoming.filter(
          (row) => resolveTicketStatus(row, row.event, row.ticket, now) === 'active',
        ).length,
      },
    };
  },

  async listPast(userId: string, query: ListPastTicketsQuery) {
    const favoriteIds = await getFavoriteIds(userId);
    const allRows = await fetchTicketRows(userId);
    const past = filterPastRows(allRows, query).sort(
      (a, b) => b.event.startsAt.getTime() - a.event.startsAt.getTime(),
    );

    const { items, meta } = paginate(past, query.page, query.limit);
    const now = new Date();

    return {
      tickets: items.map((row) => formatPastTicket(row, favoriteIds.has(row.eventId))),
      meta: {
        ...meta,
        attended_count: past.filter(
          (row) => resolveTicketStatus(row, row.event, row.ticket, now) === 'validated',
        ).length,
      },
    };
  },

  async getTicketDetail(userId: string, ticketId: string) {
    const row = await getTicketRowForUser(userId, ticketId);
    const favoriteIds = await getFavoriteIds(userId);
    return formatTicketDetail(row, favoriteIds.has(row.eventId));
  },

  async getTicketQr(userId: string, ticketId: string) {
    return invitationsService.getTicket(userId, ticketId);
  },

  async getYearlySummary(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { category: true },
    });

    const rows = await fetchTicketRows(userId);
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const pastThisYear = rows.filter(
      (row) =>
        isPastTicket(row, now) &&
        row.event.startsAt >= yearStart &&
        resolveTicketStatus(row, row.event, row.ticket, now) === 'validated',
    );

    const producerCounts = new Map<string, { name: string; count: number }>();
    for (const row of pastThisYear) {
      const current = producerCounts.get(row.producerId) ?? {
        name: row.producer.name,
        count: 0,
      };
      current.count += 1;
      producerCounts.set(row.producerId, current);
    }

    const favoriteProducer = [...producerCounts.values()].sort((a, b) => b.count - a.count)[0];

    return {
      year: now.getUTCFullYear(),
      events_attended: pastThisYear.length,
      current_category: user.category,
      favorite_producer: favoriteProducer
        ? { name: favoriteProducer.name, events_attended: favoriteProducer.count }
        : null,
    };
  },
};
