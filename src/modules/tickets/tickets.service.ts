import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { invitationsService } from '../invitations/invitations.service.js';
import { ticketOrdersService } from '../ticket-orders/ticket-orders.service.js';
import { formatPastTicket, formatTicketDetail, formatUpcomingTicket } from './tickets.formatter.js';
import type { InvitationTicketRow } from './tickets.utils.js';
import {
  canCancelTicket,
  eventStillActiveCutoff,
  isPastTicket,
  isUpcomingTicket,
  resolveTicketStatus,
} from './tickets.utils.js';
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

async function getOrderStatusByInvitationIds(
  userId: string,
  rows: InvitationTicketRow[],
): Promise<Map<string, string>> {
  if (rows.length === 0) {
    return new Map();
  }

  const invitationIds = rows.map((row) => row.id);
  const slots = await prisma.ticketSlot.findMany({
    where: { invitationId: { in: invitationIds } },
    select: {
      invitationId: true,
      order: { select: { status: true } },
    },
  });

  const map = new Map<string, string>();
  for (const slot of slots) {
    if (slot.invitationId) {
      map.set(slot.invitationId, slot.order.status);
    }
  }

  const canceledRows = rows.filter((row) => row.status === 'canceled');
  const missingRefundLookup = canceledRows.filter((row) => !map.has(row.id));
  if (missingRefundLookup.length > 0) {
    const eventIds = [...new Set(missingRefundLookup.map((row) => row.eventId))];
    const refundedOrders = await prisma.ticketOrder.findMany({
      where: {
        buyerUserId: userId,
        eventId: { in: eventIds },
        status: 'refunded',
      },
      select: { eventId: true },
    });
    const refundedEventIds = new Set(refundedOrders.map((order) => order.eventId));
    for (const row of missingRefundLookup) {
      if (refundedEventIds.has(row.eventId)) {
        map.set(row.id, 'refunded');
      }
    }
  }

  return map;
}

async function fetchUpcomingRows(userId: string, now = new Date()): Promise<InvitationTicketRow[]> {
  const cutoff = eventStillActiveCutoff(now);
  const rows = await prisma.invitation.findMany({
    where: {
      recipientUserId: userId,
      status: { in: ['accepted', 'validated'] },
      ticket: { isNot: null },
      event: { startsAt: { gte: cutoff } },
    },
    include: ticketInclude,
    orderBy: { event: { startsAt: 'asc' } },
  });

  return (rows as InvitationTicketRow[]).filter((row) => isUpcomingTicket(row, now));
}

async function fetchPastRows(userId: string, now = new Date()): Promise<InvitationTicketRow[]> {
  const cutoff = eventStillActiveCutoff(now);
  const rows = await prisma.invitation.findMany({
    where: {
      recipientUserId: userId,
      OR: [
        { status: 'canceled' },
        {
          status: { in: ['accepted', 'validated'] },
          ticket: { isNot: null },
          event: { startsAt: { lt: cutoff } },
        },
      ],
    },
    include: ticketInclude,
    orderBy: { event: { startsAt: 'desc' } },
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

function filterPastRows(
  rows: InvitationTicketRow[],
  query: ListPastTicketsQuery,
  orderStatusByInvitation: Map<string, string>,
  now = new Date(),
): InvitationTicketRow[] {
  return rows.filter((row) => {
    const orderStatus = orderStatusByInvitation.get(row.id) ?? null;
    if (!isPastTicket(row, now, orderStatus)) return false;

    if (query.event_type && row.event.eventType.slug !== query.event_type) return false;

    if (query.search && !matchesSearch(row, query.search.trim())) return false;

    const status = resolveTicketStatus(row, row.event, row.ticket, now, orderStatus);
    if (query.status === 'attended' && status !== 'validated') return false;
    if (query.status === 'not_attended' && status !== 'expired') return false;
    if (query.status === 'cancelled' && status !== 'cancelled' && status !== 'refunded') {
      return false;
    }

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
      status: { in: ['accepted', 'validated'] },
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
    const upcoming = await fetchUpcomingRows(userId, now);
    const assignMap = await ticketOrdersService.getAssignabilityByInvitationIds(
      userId,
      upcoming.map((row) => row.id),
    );
    const { items, meta } = paginate(upcoming, query.page, query.limit);

    return {
      tickets: items.map((row) => {
        const assign = assignMap.get(row.id);
        const assignMeta = assign
          ? { order_id: assign.orderId, available_count: assign.available }
          : null;
        return formatUpcomingTicket(row, favoriteIds.has(row.eventId), assignMeta);
      }),
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
    const now = new Date();
    const allRows = await fetchPastRows(userId, now);
    const orderStatusByInvitation = await getOrderStatusByInvitationIds(userId, allRows);
    const past = filterPastRows(allRows, query, orderStatusByInvitation, now).sort(
      (a, b) => b.event.startsAt.getTime() - a.event.startsAt.getTime(),
    );

    const { items, meta } = paginate(past, query.page, query.limit);

    return {
      tickets: items.map((row) => {
        const orderStatus = orderStatusByInvitation.get(row.id) ?? null;
        return formatPastTicket(
          row,
          favoriteIds.has(row.eventId),
          null,
          orderStatus,
        );
      }),
      meta: {
        ...meta,
        attended_count: past.filter(
          (row) =>
            resolveTicketStatus(
              row,
              row.event,
              row.ticket,
              now,
              orderStatusByInvitation.get(row.id),
            ) === 'validated',
        ).length,
      },
    };
  },

  async getTicketDetail(userId: string, ticketId: string) {
    const row = await getTicketRowForUser(userId, ticketId);
    const favoriteIds = await getFavoriteIds(userId);
    const assignMap = await ticketOrdersService.getAssignabilityByInvitationIds(userId, [row.id]);
    const assign = assignMap.get(row.id);
    const assignMeta = assign
      ? { order_id: assign.orderId, available_count: assign.available }
      : null;
    return formatTicketDetail(row, favoriteIds.has(row.eventId), assignMeta);
  },

  async getTicketQr(userId: string, userPhone: string, ticketId: string) {
    return invitationsService.getTicket(userId, userPhone, ticketId);
  },

  async cancelTicket(userId: string, ticketId: string) {
    const row = await prisma.invitation.findFirst({
      where: {
        id: ticketId,
        recipientUserId: userId,
        status: 'accepted',
        ticket: { isNot: null },
      },
      include: {
        ...ticketInclude,
        ticket: true,
      },
    });

    if (!row || !row.ticket) {
      throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
    }

    const now = new Date();
    if (!canCancelTicket(row, row.event, now)) {
      throw new AppError(
        409,
        'TICKET_NOT_CANCELLABLE',
        'Cancellation is no longer available for this ticket',
      );
    }

    const slot = await prisma.ticketSlot.findFirst({
      where: { invitationId: ticketId },
      include: { order: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: ticketId },
        data: {
          status: 'canceled',
          respondedAt: now,
        },
      });

      if (slot?.order.status === 'paid') {
        await tx.ticketOrder.update({
          where: { id: slot.orderId },
          data: {
            status: 'refunded',
            paymentReference: slot.order.paymentReference
              ? `${slot.order.paymentReference}:user-cancel`
              : 'user-cancel-refund',
          },
        });
      }
    });

    const favoriteIds = await getFavoriteIds(userId);
    const orderStatus = slot?.order.status === 'paid' ? 'refunded' : null;
    const updated = await prisma.invitation.findUniqueOrThrow({
      where: { id: ticketId },
      include: ticketInclude,
    });

    return formatPastTicket(
      updated as InvitationTicketRow,
      favoriteIds.has(updated.eventId),
      null,
      orderStatus,
    );
  },

  async getYearlySummary(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { category: true },
    });

    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const rows = await fetchPastRows(userId, now);
    const orderStatusByInvitation = await getOrderStatusByInvitationIds(userId, rows);

    const pastThisYear = rows.filter(
      (row) =>
        isPastTicket(row, now, orderStatusByInvitation.get(row.id)) &&
        row.event.startsAt >= yearStart &&
        resolveTicketStatus(
          row,
          row.event,
          row.ticket,
          now,
          orderStatusByInvitation.get(row.id),
        ) === 'validated',
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
