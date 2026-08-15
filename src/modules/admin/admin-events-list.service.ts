import { prisma } from '../../config/database.js';

const DRINK_ORDER_STATUSES = ['confirmed', 'redeemed'] as const;

function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfDayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export type AdminEventListStats = {
  tickets_sold: number;
  total_revenue_clp: number;
  revenue_delta_pct: number;
  capacity_total: number | null;
  capacity_available: number | null;
  ticket_order_count: number;
  drink_order_count: number;
};

export async function loadAdminEventListStats(eventIds: string[]) {
  if (eventIds.length === 0) {
    return {
      statsByEventId: new Map<string, AdminEventListStats>(),
      createdThisMonth: 0,
    };
  }

  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const monthStart = startOfMonthUtc(now);

  const [
    ticketSales,
    drinkRevenue,
    offeringCapacity,
    ticketCounts,
    drinkCounts,
    ticketRevenueToday,
    ticketRevenueYesterday,
    drinkRevenueToday,
    drinkRevenueYesterday,
    createdThisMonth,
  ] = await Promise.all([
    prisma.ticketOrder.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds }, status: 'paid' },
      _sum: { quantity: true, totalAmount: true },
      _count: { _all: true },
    }),
    prisma.eventDrinkOrder.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: { in: [...DRINK_ORDER_STATUSES] },
      },
      _sum: { totalClp: true },
      _count: { _all: true },
    }),
    prisma.eventTicketOffering.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds } },
      _sum: { stockTotal: true, stockRemaining: true },
    }),
    prisma.ticketOrder.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds }, status: 'paid' },
      _count: { _all: true },
    }),
    prisma.eventDrinkOrder.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: { in: [...DRINK_ORDER_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.ticketOrder.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: 'paid',
        createdAt: { gte: todayStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.ticketOrder.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: 'paid',
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.eventDrinkOrder.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: { in: [...DRINK_ORDER_STATUSES] },
        createdAt: { gte: todayStart },
      },
      _sum: { totalClp: true },
    }),
    prisma.eventDrinkOrder.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: { in: [...DRINK_ORDER_STATUSES] },
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
      _sum: { totalClp: true },
    }),
    prisma.event.count({
      where: { createdAt: { gte: monthStart } },
    }),
  ]);

  const ticketSalesByEvent = new Map(ticketSales.map((row) => [row.eventId, row]));
  const drinkRevenueByEvent = new Map(drinkRevenue.map((row) => [row.eventId, row]));
  const capacityByEvent = new Map(offeringCapacity.map((row) => [row.eventId, row]));
  const ticketCountByEvent = new Map(ticketCounts.map((row) => [row.eventId, row._count._all]));
  const drinkCountByEvent = new Map(drinkCounts.map((row) => [row.eventId, row._count._all]));
  const ticketRevenueTodayByEvent = new Map(
    ticketRevenueToday.map((row) => [row.eventId, Math.round(row._sum.totalAmount ?? 0)]),
  );
  const ticketRevenueYesterdayByEvent = new Map(
    ticketRevenueYesterday.map((row) => [row.eventId, Math.round(row._sum.totalAmount ?? 0)]),
  );
  const drinkRevenueTodayByEvent = new Map(
    drinkRevenueToday.map((row) => [row.eventId, row._sum.totalClp ?? 0]),
  );
  const drinkRevenueYesterdayByEvent = new Map(
    drinkRevenueYesterday.map((row) => [row.eventId, row._sum.totalClp ?? 0]),
  );

  const statsByEventId = new Map<string, AdminEventListStats>();

  for (const eventId of eventIds) {
    const tickets = ticketSalesByEvent.get(eventId);
    const drinks = drinkRevenueByEvent.get(eventId);
    const capacity = capacityByEvent.get(eventId);
    const ticketRevenue = Math.round(tickets?._sum.totalAmount ?? 0);
    const drinkRev = drinks?._sum.totalClp ?? 0;
    const totalRevenue = ticketRevenue + drinkRev;
    const todayRevenue =
      (ticketRevenueTodayByEvent.get(eventId) ?? 0) + (drinkRevenueTodayByEvent.get(eventId) ?? 0);
    const yesterdayRevenue =
      (ticketRevenueYesterdayByEvent.get(eventId) ?? 0) +
      (drinkRevenueYesterdayByEvent.get(eventId) ?? 0);

    const stockTotal = capacity?._sum.stockTotal;
    const stockRemaining = capacity?._sum.stockRemaining;

    statsByEventId.set(eventId, {
      tickets_sold: tickets?._sum.quantity ?? 0,
      total_revenue_clp: totalRevenue,
      revenue_delta_pct: percentDelta(todayRevenue, yesterdayRevenue),
      capacity_total: stockTotal ?? null,
      capacity_available: stockRemaining ?? null,
      ticket_order_count: ticketCountByEvent.get(eventId) ?? 0,
      drink_order_count: drinkCountByEvent.get(eventId) ?? 0,
    });
  }

  return { statsByEventId, createdThisMonth };
}
