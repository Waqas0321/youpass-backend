import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { TYPE_LABELS } from '../ticket-offerings/ticket-offering.types.js';
import type { TicketCatalogType } from '@prisma/client';

const DASHBOARD_TIMEZONE = 'America/Santiago';
const DRINK_ORDER_STATUSES = ['confirmed', 'redeemed'] as const;
const ACTIVITY_LIMIT = 8;
const TOP_BAR_LIMIT = 5;

const CATALOG_TYPE_LABELS: Record<TicketCatalogType, string> = {
  general: TYPE_LABELS.general,
  vip: TYPE_LABELS.vip_general,
  vip_table: 'VIP Table',
  courtesy: 'Courtesy',
  free: 'Free',
  discounted: 'Discounted',
};
export const DASHBOARD_SALES_PERIODS = ['today', 'yesterday', 'last_7_days', 'all_time'] as const;
export type DashboardSalesPeriod = (typeof DASHBOARD_SALES_PERIODS)[number];

type DayWindow = {
  gte: Date;
  lte: Date;
};

type MetricTotals = {
  ticketsSold: number;
  totalRevenueClp: number;
  barConsumption: number;
  activeUsers: number;
};

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfDayInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function endOfDayUtc(date: Date) {
  const next = new Date(date);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

function dayWindow(daysAgo: number, now = new Date()): DayWindow {
  const todayStart = startOfDayInTimezone(now, DASHBOARD_TIMEZONE);
  const start = addDaysUtc(todayStart, -daysAgo);
  return { gte: start, lte: endOfDayUtc(start) };
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function hourInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  return hour === 24 ? 0 : hour;
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, currencyCode: true },
  });

  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  return event;
}

async function sumTicketQuantity(eventId: string, window?: DayWindow) {
  const result = await prisma.ticketOrder.aggregate({
    where: {
      eventId,
      status: 'paid',
      ...(window ? { createdAt: window } : {}),
    },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
}

async function sumTicketRevenueClp(eventId: string, window?: DayWindow) {
  const result = await prisma.ticketOrder.aggregate({
    where: {
      eventId,
      status: 'paid',
      ...(window ? { createdAt: window } : {}),
    },
    _sum: { totalAmount: true },
  });

  return Math.round(result._sum.totalAmount ?? 0);
}

async function sumDrinkRevenueClp(eventId: string, window?: DayWindow) {
  const result = await prisma.eventDrinkOrder.aggregate({
    where: {
      eventId,
      status: { in: [...DRINK_ORDER_STATUSES] },
      ...(window ? { createdAt: window } : {}),
    },
    _sum: { totalClp: true },
  });

  return result._sum.totalClp ?? 0;
}

async function sumBarConsumption(eventId: string, window?: DayWindow) {
  const result = await prisma.eventDrinkOrderLine.aggregate({
    where: {
      order: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
    },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
}

async function countActiveUsers(eventId: string, window?: DayWindow) {
  const [ticketUsers, drinkUsers] = await Promise.all([
    prisma.ticketOrder.findMany({
      where: {
        eventId,
        status: 'paid',
        ...(window ? { createdAt: window } : {}),
      },
      select: { buyerUserId: true },
      distinct: ['buyerUserId'],
    }),
    prisma.eventDrinkOrder.findMany({
      where: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const unique = new Set<string>();
  for (const row of ticketUsers) unique.add(row.buyerUserId);
  for (const row of drinkUsers) unique.add(row.userId);
  return unique.size;
}

async function collectMetricTotals(eventId: string, window?: DayWindow): Promise<MetricTotals> {
  const [ticketsSold, ticketRevenueClp, drinkRevenueClp, barConsumption, activeUsers] =
    await Promise.all([
      sumTicketQuantity(eventId, window),
      sumTicketRevenueClp(eventId, window),
      sumDrinkRevenueClp(eventId, window),
      sumBarConsumption(eventId, window),
      countActiveUsers(eventId, window),
    ]);

  return {
    ticketsSold,
    totalRevenueClp: ticketRevenueClp + drinkRevenueClp,
    barConsumption,
    activeUsers,
  };
}

function salesPeriodWindow(period: DashboardSalesPeriod, now = new Date()): DayWindow | undefined {
  if (period === 'all_time') {
    return undefined;
  }
  if (period === 'today') {
    return dayWindow(0, now);
  }
  if (period === 'yesterday') {
    return dayWindow(1, now);
  }

  const todayStart = startOfDayInTimezone(now, DASHBOARD_TIMEZONE);
  return {
    gte: addDaysUtc(todayStart, -6),
    lte: endOfDayUtc(todayStart),
  };
}

function parseSalesPeriod(value: unknown): DashboardSalesPeriod {
  if (typeof value === 'string' && DASHBOARD_SALES_PERIODS.includes(value as DashboardSalesPeriod)) {
    return value as DashboardSalesPeriod;
  }
  return 'today';
}

async function buildHourlyTicketSales(eventId: string, period: DashboardSalesPeriod = 'today') {
  const window = salesPeriodWindow(period);
  const orders = await prisma.ticketOrder.findMany({
    where: {
      eventId,
      status: 'paid',
      ...(window ? { createdAt: window } : {}),
    },
    select: {
      quantity: true,
      createdAt: true,
    },
  });

  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));
  for (const order of orders) {
    const hour = hourInTimezone(order.createdAt, DASHBOARD_TIMEZONE);
    buckets[hour].value += order.quantity;
  }

  return buckets;
}

async function buildHourlyTicketSalesLast24Hours(eventId: string, now = new Date()) {
  const bucketMs = 60 * 60 * 1000;
  const start = new Date(now.getTime() - 24 * bucketMs);
  const orders = await prisma.ticketOrder.findMany({
    where: {
      eventId,
      status: 'paid',
      createdAt: { gte: start, lte: now },
    },
    select: {
      quantity: true,
      createdAt: true,
    },
  });

  const buckets = Array.from({ length: 24 }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketMs);
    return {
      hour: hourInTimezone(bucketStart, DASHBOARD_TIMEZONE),
      value: 0,
    };
  });

  for (const order of orders) {
    const offset = order.createdAt.getTime() - start.getTime();
    if (offset < 0) {
      continue;
    }
    const index = Math.min(23, Math.floor(offset / bucketMs));
    buckets[index].value += order.quantity;
  }

  return buckets;
}

async function buildHourlyTicketSalesByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const hourly = await buildHourlyTicketSales(eventId, period);
      return [period, hourly] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<DashboardSalesPeriod, Awaited<ReturnType<typeof buildHourlyTicketSales>>>;
}

async function buildTopBarItems(eventId: string, window?: DayWindow) {
  const lines = await prisma.eventDrinkOrderLine.findMany({
    where: {
      order: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
    },
    select: {
      productId: true,
      productName: true,
      quantity: true,
    },
  });

  const counts = new Map<string, { product_id: string | null; name: string; count: number }>();
  for (const line of lines) {
    const key = line.productId ?? line.productName;
    const existing = counts.get(key);
    if (existing) {
      existing.count += line.quantity;
    } else {
      counts.set(key, {
        product_id: line.productId,
        name: line.productName,
        count: line.quantity,
      });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, TOP_BAR_LIMIT);
}

async function buildTopBarItemsByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const items = await buildTopBarItems(eventId, salesPeriodWindow(period));
      return [period, items] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildTopBarItems>>
  >;
}

async function buildTicketsByCategory(eventId: string, window?: DayWindow) {
  const [offerings, orders] = await Promise.all([
    prisma.eventTicketOffering.findMany({
      where: { eventId },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.ticketOrder.findMany({
      where: {
        eventId,
        status: 'paid',
        ...(window ? { createdAt: window } : {}),
      },
      select: {
        quantity: true,
        ticketOfferingId: true,
        type: true,
      },
    }),
  ]);

  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]));
  const counts = new Map<string, { offering_id: string | null; type: string; label: string; count: number }>();

  for (const order of orders) {
    if (order.ticketOfferingId) {
      const offering = offeringMap.get(order.ticketOfferingId);
      const key = `offering:${order.ticketOfferingId}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += order.quantity;
      } else {
        counts.set(key, {
          offering_id: order.ticketOfferingId,
          type: offering?.type ?? 'general',
          label: offering?.name ?? TYPE_LABELS.general,
          count: order.quantity,
        });
      }
      continue;
    }

    const key = `type:${order.type}`;
    const label = CATALOG_TYPE_LABELS[order.type] ?? TYPE_LABELS.general;
    const existing = counts.get(key);
    if (existing) {
      existing.count += order.quantity;
    } else {
      counts.set(key, {
        offering_id: null,
        type: order.type,
        label,
        count: order.quantity,
      });
    }
  }

  return [...counts.values()].filter((slice) => slice.count > 0).sort((a, b) => b.count - a.count);
}

async function buildTicketsByCategoryByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const categories = await buildTicketsByCategory(eventId, salesPeriodWindow(period));
      return [period, categories] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildTicketsByCategory>>
  >;
}

type RawActivity = {
  id: string;
  kind: 'ticket_purchase' | 'drink_purchase' | 'drink_redemption' | 'ticket_redemption' | 'table_assigned';
  occurred_at: Date;
  actor_name: string;
  product_name?: string;
  quantity?: number;
  offering_name?: string;
  table_label?: string;
  zone_name?: string;
  subtitle?: string;
};

async function buildRecentActivity(eventId: string, window?: DayWindow) {
  const offeringNameById = new Map(
    (
      await prisma.eventTicketOffering.findMany({
        where: { eventId },
        select: { id: true, name: true },
      })
    ).map((offering) => [offering.id, offering.name]),
  );

  const [
    ticketOrders,
    drinkOrders,
    drinkRedemptions,
    ticketRedemptions,
    soldTables,
  ] = await Promise.all([
    prisma.ticketOrder.findMany({
      where: {
        eventId,
        status: 'paid',
        ...(window ? { createdAt: window } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        ticketOfferingId: true,
        type: true,
        venueTableId: true,
        buyer: { select: { fullName: true } },
      },
    }),
    prisma.eventDrinkOrder.findMany({
      where: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        user: { select: { fullName: true } },
        lines: { select: { productName: true, quantity: true } },
      },
    }),
    prisma.eventDrinkRedemption.findMany({
      where: {
        validatedAt: window ? { not: null, gte: window.gte, lte: window.lte } : { not: null },
        order: { eventId },
      },
      orderBy: { validatedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        validatedAt: true,
        line: { select: { productName: true } },
        order: { select: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.invitationTicket.findMany({
      where: {
        validatedAt: window ? { not: null, gte: window.gte, lte: window.lte } : { not: null },
        invitation: { eventId },
      },
      orderBy: { validatedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        validatedAt: true,
        invitation: {
          select: {
            assignedSlot: true,
            recipientName: true,
            recipient: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.venueTable.findMany({
      where: {
        eventId,
        status: 'sold',
        soldAt: window ? { not: null, gte: window.gte, lte: window.lte } : { not: null },
      },
      orderBy: { soldAt: 'desc' },
      take: 10,
      select: {
        id: true,
        label: true,
        soldAt: true,
        soldToUser: { select: { fullName: true } },
        zone: { select: { name: true } },
      },
    }),
  ]);

  const raw: RawActivity[] = [];

  for (const order of ticketOrders) {
    if (order.venueTableId) continue;
    const offeringName = order.ticketOfferingId
      ? offeringNameById.get(order.ticketOfferingId)
      : undefined;
    const typeLabel = CATALOG_TYPE_LABELS[order.type] ?? TYPE_LABELS.general;
    raw.push({
      id: `ticket-order-${order.id}`,
      kind: 'ticket_purchase',
      occurred_at: order.createdAt,
      actor_name: order.buyer.fullName,
      quantity: order.quantity,
      offering_name: offeringName ?? typeLabel,
    });
  }

  for (const order of drinkOrders) {
    const firstLine = order.lines[0];
    const totalQty = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    raw.push({
      id: `drink-order-${order.id}`,
      kind: 'drink_purchase',
      occurred_at: order.createdAt,
      actor_name: order.user.fullName,
      product_name: firstLine?.productName,
      quantity: totalQty,
      subtitle: firstLine?.productName,
    });
  }

  for (const redemption of drinkRedemptions) {
    if (!redemption.validatedAt) continue;
    raw.push({
      id: `drink-redemption-${redemption.id}`,
      kind: 'drink_redemption',
      occurred_at: redemption.validatedAt,
      actor_name: redemption.order.user.fullName,
      product_name: redemption.line?.productName,
      subtitle: redemption.line?.productName ?? undefined,
    });
  }

  for (const ticket of ticketRedemptions) {
    if (!ticket.validatedAt) continue;
    const actorName =
      ticket.invitation.recipient?.fullName ??
      ticket.invitation.recipientName ??
      'Guest';
    raw.push({
      id: `ticket-redemption-${ticket.id}`,
      kind: 'ticket_redemption',
      occurred_at: ticket.validatedAt,
      actor_name: actorName,
      subtitle: ticket.invitation.assignedSlot,
    });
  }

  for (const table of soldTables) {
    if (!table.soldAt) continue;
    raw.push({
      id: `table-sold-${table.id}`,
      kind: 'table_assigned',
      occurred_at: table.soldAt,
      actor_name: table.soldToUser?.fullName ?? 'Guest',
      table_label: table.label,
      zone_name: table.zone.name,
      subtitle: table.zone.name,
    });
  }

  return raw
    .sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime())
    .slice(0, ACTIVITY_LIMIT)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      occurred_at: item.occurred_at.toISOString(),
      actor_name: item.actor_name,
      product_name: item.product_name,
      quantity: item.quantity,
      offering_name: item.offering_name,
      table_label: item.table_label,
      zone_name: item.zone_name,
      subtitle: item.subtitle,
    }));
}

async function buildRecentActivityByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const activity = await buildRecentActivity(eventId, salesPeriodWindow(period));
      return [period, activity] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildRecentActivity>>
  >;
}

function previous7DaysWindow(now = new Date()): DayWindow {
  const todayStart = startOfDayInTimezone(now, DASHBOARD_TIMEZONE);
  const end = endOfDayUtc(addDaysUtc(todayStart, -7));
  return {
    gte: addDaysUtc(todayStart, -13),
    lte: end,
  };
}

type DashboardKpiBlock = {
  tickets_sold: { value: number; delta_pct: number | null; sparkline: number[] };
  total_revenue: { value: number; delta_pct: number | null; sparkline: number[] };
  bar_consumption: { value: number; delta_pct: number | null; sparkline: number[] };
  active_users: { value: number; delta_pct: number | null; sparkline: number[] };
};

function buildKpiBlock(
  current: MetricTotals,
  previous: MetricTotals | null,
  sparklines: {
    tickets: number[];
    revenue: number[];
    bar: number[];
    users: number[];
  },
): DashboardKpiBlock {
  const delta = (currentValue: number, previousValue: number) =>
    previous ? percentDelta(currentValue, previousValue) : null;

  return {
    tickets_sold: {
      value: current.ticketsSold,
      delta_pct: delta(current.ticketsSold, previous?.ticketsSold ?? 0),
      sparkline: sparklines.tickets,
    },
    total_revenue: {
      value: current.totalRevenueClp,
      delta_pct: delta(current.totalRevenueClp, previous?.totalRevenueClp ?? 0),
      sparkline: sparklines.revenue,
    },
    bar_consumption: {
      value: current.barConsumption,
      delta_pct: delta(current.barConsumption, previous?.barConsumption ?? 0),
      sparkline: sparklines.bar,
    },
    active_users: {
      value: current.activeUsers,
      delta_pct: delta(current.activeUsers, previous?.activeUsers ?? 0),
      sparkline: sparklines.users,
    },
  };
}

function comparisonSparklines(previous: MetricTotals, current: MetricTotals) {
  return {
    tickets: [previous.ticketsSold, current.ticketsSold],
    revenue: [previous.totalRevenueClp, current.totalRevenueClp],
    bar: [previous.barConsumption, current.barConsumption],
    users: [previous.activeUsers, current.activeUsers],
  };
}

const EMPTY_KPI_SPARKLINES = {
  tickets: [] as number[],
  revenue: [] as number[],
  bar: [] as number[],
  users: [] as number[],
};

type DashboardSlice = { label: string; value: number };

function bucketHourlyRevenue(
  ticketOrders: Array<{ totalAmount: number; createdAt: Date }>,
  drinkOrders: Array<{ totalClp: number; createdAt: Date }>,
) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));

  for (const order of ticketOrders) {
    const hour = hourInTimezone(order.createdAt, DASHBOARD_TIMEZONE);
    buckets[hour].value += Math.round(order.totalAmount);
  }

  for (const order of drinkOrders) {
    const hour = hourInTimezone(order.createdAt, DASHBOARD_TIMEZONE);
    buckets[hour].value += order.totalClp;
  }

  return buckets;
}

async function fetchRevenueOrders(eventId: string, window?: DayWindow) {
  const [ticketOrders, drinkOrders] = await Promise.all([
    prisma.ticketOrder.findMany({
      where: {
        eventId,
        status: 'paid',
        ...(window ? { createdAt: window } : {}),
      },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.eventDrinkOrder.findMany({
      where: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
      select: { totalClp: true, createdAt: true },
    }),
  ]);

  return { ticketOrders, drinkOrders };
}

async function buildHourlyRevenue(eventId: string, period: DashboardSalesPeriod = 'all_time') {
  const window = salesPeriodWindow(period);
  const { ticketOrders, drinkOrders } = await fetchRevenueOrders(eventId, window);
  return bucketHourlyRevenue(ticketOrders, drinkOrders);
}

async function buildHourlyRevenueByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const hourly = await buildHourlyRevenue(eventId, period);
      return [period, hourly] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildHourlyRevenue>>
  >;
}

async function buildConsumptionByCategory(eventId: string, window?: DayWindow) {
  const lines = await prisma.eventDrinkOrderLine.findMany({
    where: {
      order: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
    },
    select: {
      productId: true,
      quantity: true,
    },
  });

  if (lines.length === 0) {
    return [] as DashboardSlice[];
  }

  const productIds = [
    ...new Set(lines.map((line) => line.productId).filter((id): id is string => Boolean(id))),
  ];
  const [products, categories] = await Promise.all([
    productIds.length
      ? prisma.eventDrinkProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true },
        })
      : Promise.resolve([]),
    prisma.eventDrinkCategory.findMany({
      where: { eventId },
      select: { id: true, name: true },
    }),
  ]);

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const productCategoryById = new Map(products.map((product) => [product.id, product.categoryId]));
  const counts = new Map<string, DashboardSlice>();

  for (const line of lines) {
    const categoryId = line.productId ? productCategoryById.get(line.productId) : null;
    const label = categoryId ? categoryNameById.get(categoryId) ?? 'Other' : 'Other';
    const existing = counts.get(label);
    if (existing) {
      existing.value += line.quantity;
    } else {
      counts.set(label, { label, value: line.quantity });
    }
  }

  return [...counts.values()].filter((slice) => slice.value > 0).sort((a, b) => b.value - a.value);
}

async function buildConsumptionByCategoryByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const slices = await buildConsumptionByCategory(eventId, salesPeriodWindow(period));
      return [period, slices] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildConsumptionByCategory>>
  >;
}

async function buildRevenueByZone(eventId: string, window?: DayWindow) {
  const zoneRows = await prisma.venueZone.findMany({
    where: { layout: { eventId } },
    select: { id: true, name: true },
  });
  const zoneNameById = new Map(zoneRows.map((zone) => [zone.id, zone.name]));
  const revenue = new Map<string, number>();

  const [ticketOrders, soldTables] = await Promise.all([
    prisma.ticketOrder.findMany({
      where: {
        eventId,
        status: 'paid',
        venueZoneId: { not: null },
        ...(window ? { createdAt: window } : {}),
      },
      select: { venueZoneId: true, totalAmount: true },
    }),
    prisma.venueTable.findMany({
      where: {
        eventId,
        status: 'sold',
        ...(window
          ? { soldAt: { not: null, gte: window.gte, lte: window.lte } }
          : { soldAt: { not: null } }),
      },
      select: { zoneId: true, price: true },
    }),
  ]);

  for (const order of ticketOrders) {
    if (!order.venueZoneId) {
      continue;
    }
    revenue.set(
      order.venueZoneId,
      (revenue.get(order.venueZoneId) ?? 0) + Math.round(order.totalAmount),
    );
  }

  for (const table of soldTables) {
    revenue.set(table.zoneId, (revenue.get(table.zoneId) ?? 0) + Math.round(table.price));
  }

  return [...revenue.entries()]
    .map(([zoneId, value]) => ({
      zone_id: zoneId,
      label: zoneNameById.get(zoneId) ?? 'Zone',
      value,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

async function buildRevenueByZoneByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const rows = await buildRevenueByZone(eventId, salesPeriodWindow(period));
      return [period, rows] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildRevenueByZone>>
  >;
}

async function buildTopSpenders(eventId: string, window?: DayWindow, limit = TOP_BAR_LIMIT) {
  const [ticketOrders, drinkOrders] = await Promise.all([
    prisma.ticketOrder.findMany({
      where: {
        eventId,
        status: 'paid',
        ...(window ? { createdAt: window } : {}),
      },
      select: {
        buyerUserId: true,
        totalAmount: true,
      },
    }),
    prisma.eventDrinkOrder.findMany({
      where: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
      select: {
        userId: true,
        totalClp: true,
      },
    }),
  ]);

  const spendByUser = new Map<string, { purchase_count: number; total_spend: number }>();

  for (const order of ticketOrders) {
    const existing = spendByUser.get(order.buyerUserId) ?? { purchase_count: 0, total_spend: 0 };
    existing.purchase_count += 1;
    existing.total_spend += Math.round(order.totalAmount);
    spendByUser.set(order.buyerUserId, existing);
  }

  for (const order of drinkOrders) {
    const existing = spendByUser.get(order.userId) ?? { purchase_count: 0, total_spend: 0 };
    existing.purchase_count += 1;
    existing.total_spend += order.totalClp;
    spendByUser.set(order.userId, existing);
  }

  const userIds = [...spendByUser.keys()];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true },
        })
      : [];
  const nameById = new Map(users.map((user) => [user.id, user.fullName]));

  return [...spendByUser.entries()]
    .map(([userId, stats]) => ({
      user_id: userId,
      name: nameById.get(userId) ?? 'Guest',
      purchase_count: stats.purchase_count,
      total_spend: stats.total_spend,
    }))
    .sort((a, b) => b.total_spend - a.total_spend || b.purchase_count - a.purchase_count)
    .slice(0, limit);
}

async function buildTopSpendersByPeriod(eventId: string) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const spenders = await buildTopSpenders(eventId, salesPeriodWindow(period));
      return [period, spenders] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildTopSpenders>>
  >;
}

function bucketByHour(dates: Date[]) {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const date of dates) {
    buckets[hourInTimezone(date, DASHBOARD_TIMEZONE)] += 1;
  }
  return buckets;
}

function peakHourFromBuckets(buckets: number[]) {
  let peakHour = 0;
  let peakValue = 0;
  for (let hour = 0; hour < buckets.length; hour += 1) {
    if (buckets[hour] > peakValue) {
      peakValue = buckets[hour];
      peakHour = hour;
    }
  }
  return peakValue > 0 ? peakHour : null;
}

async function buildBehaviorInsights(eventId: string, activeUsers: number, window?: DayWindow) {
  const validatedAtFilter = window
    ? { not: null, gte: window.gte, lte: window.lte }
    : { not: null };

  const [entryTickets, drinkRedemptions, ticketOrderGroups, drinkOrderGroups] = await Promise.all([
    prisma.invitationTicket.findMany({
      where: {
        invitation: { eventId },
        validatedAt: validatedAtFilter,
      },
      select: { validatedAt: true },
    }),
    prisma.eventDrinkRedemption.findMany({
      where: {
        validatedAt: validatedAtFilter,
        order: { eventId },
      },
      select: { validatedAt: true },
    }),
    prisma.ticketOrder.groupBy({
      by: ['buyerUserId'],
      where: {
        eventId,
        status: 'paid',
        ...(window ? { createdAt: window } : {}),
      },
      _count: { _all: true },
    }),
    prisma.eventDrinkOrder.groupBy({
      by: ['userId'],
      where: {
        eventId,
        status: { in: [...DRINK_ORDER_STATUSES] },
        ...(window ? { createdAt: window } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const entryByHour = bucketByHour(
    entryTickets.map((ticket) => ticket.validatedAt).filter((date): date is Date => Boolean(date)),
  );
  const consumptionByHour = bucketByHour(
    drinkRedemptions
      .map((redemption) => redemption.validatedAt)
      .filter((date): date is Date => Boolean(date)),
  );

  const orderCountByUser = new Map<string, number>();
  for (const row of ticketOrderGroups) {
    orderCountByUser.set(row.buyerUserId, (orderCountByUser.get(row.buyerUserId) ?? 0) + row._count._all);
  }
  for (const row of drinkOrderGroups) {
    orderCountByUser.set(row.userId, (orderCountByUser.get(row.userId) ?? 0) + row._count._all);
  }

  const recurringUsers = [...orderCountByUser.values()].filter((count) => count >= 2).length;
  const recurringSharePct =
    activeUsers > 0 ? Math.round((recurringUsers / activeUsers) * 1000) / 10 : 0;

  return {
    entry_by_hour: entryByHour,
    consumption_by_hour: consumptionByHour,
    peak_entry_hour: peakHourFromBuckets(entryByHour),
    peak_consumption_hour: peakHourFromBuckets(consumptionByHour),
    recurring_users: recurringUsers,
    recurring_share_pct: recurringSharePct,
    social_conversion_pct: null as number | null,
  };
}

async function buildBehaviorInsightsByPeriod(
  eventId: string,
  kpisByPeriod: Record<DashboardSalesPeriod, DashboardKpiBlock>,
) {
  const entries = await Promise.all(
    DASHBOARD_SALES_PERIODS.map(async (period) => {
      const insights = await buildBehaviorInsights(
        eventId,
        kpisByPeriod[period].active_users.value,
        salesPeriodWindow(period),
      );
      return [period, insights] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    DashboardSalesPeriod,
    Awaited<ReturnType<typeof buildBehaviorInsights>>
  >;
}

async function buildKpisByPeriod(eventId: string): Promise<Record<DashboardSalesPeriod, DashboardKpiBlock>> {
  const [
    todayTotals,
    yesterdayTotals,
    dayBeforeTotals,
    last7Totals,
    prev7Totals,
    allTimeTotals,
  ] = await Promise.all([
    collectMetricTotals(eventId, dayWindow(0)),
    collectMetricTotals(eventId, dayWindow(1)),
    collectMetricTotals(eventId, dayWindow(2)),
    collectMetricTotals(eventId, salesPeriodWindow('last_7_days')),
    collectMetricTotals(eventId, previous7DaysWindow()),
    collectMetricTotals(eventId),
  ]);

  const todaySpark = comparisonSparklines(yesterdayTotals, todayTotals);
  const yesterdaySpark = comparisonSparklines(dayBeforeTotals, yesterdayTotals);

  return {
    today: buildKpiBlock(todayTotals, yesterdayTotals, todaySpark),
    yesterday: buildKpiBlock(yesterdayTotals, dayBeforeTotals, yesterdaySpark),
    last_7_days: buildKpiBlock(last7Totals, prev7Totals, EMPTY_KPI_SPARKLINES),
    all_time: buildKpiBlock(allTimeTotals, null, EMPTY_KPI_SPARKLINES),
  };
}
export const adminEventDashboardService = {
  async getEventDashboard(eventId: string) {
    const event = await assertEventExists(eventId);

    const [
      hourlyTicketSalesByPeriod,
      hourlyTicketSalesLast24Hours,
      hourlyRevenueByPeriod,
      topBarItemsByPeriod,
      ticketsByCategoryByPeriod,
      consumptionByCategoryByPeriod,
      revenueByZoneByPeriod,
      recentActivityByPeriod,
      kpis_by_period,
    ] = await Promise.all([
      buildHourlyTicketSalesByPeriod(eventId),
      buildHourlyTicketSalesLast24Hours(eventId),
      buildHourlyRevenueByPeriod(eventId),
      buildTopBarItemsByPeriod(eventId),
      buildTicketsByCategoryByPeriod(eventId),
      buildConsumptionByCategoryByPeriod(eventId),
      buildRevenueByZoneByPeriod(eventId),
      buildRecentActivityByPeriod(eventId),
      buildKpisByPeriod(eventId),
    ]);

    const topSpendersByPeriod = await buildTopSpendersByPeriod(eventId);
    const behaviorInsightsByPeriod = await buildBehaviorInsightsByPeriod(eventId, kpis_by_period);

    return {
      event_id: eventId,
      currency: event.currencyCode?.trim() || 'CLP',
      kpis: kpis_by_period.all_time,
      kpis_by_period,
      hourly_ticket_sales: hourlyTicketSalesLast24Hours,
      hourly_ticket_sales_last_24h: hourlyTicketSalesLast24Hours,
      hourly_ticket_sales_by_period: hourlyTicketSalesByPeriod,
      hourly_revenue: hourlyRevenueByPeriod.all_time,
      hourly_revenue_by_period: hourlyRevenueByPeriod,
      top_bar_items: topBarItemsByPeriod.all_time,
      top_bar_items_by_period: topBarItemsByPeriod,
      tickets_by_category: ticketsByCategoryByPeriod.all_time,
      tickets_by_category_by_period: ticketsByCategoryByPeriod,
      consumption_by_category: consumptionByCategoryByPeriod.all_time,
      consumption_by_category_by_period: consumptionByCategoryByPeriod,
      revenue_by_zone: revenueByZoneByPeriod.all_time,
      revenue_by_zone_by_period: revenueByZoneByPeriod,
      top_spenders: topSpendersByPeriod.all_time,
      top_spenders_by_period: topSpendersByPeriod,
      behavior_insights: behaviorInsightsByPeriod.all_time,
      behavior_insights_by_period: behaviorInsightsByPeriod,
      recent_activity: recentActivityByPeriod.all_time,
      recent_activity_by_period: recentActivityByPeriod,
    };
  },

  async getHourlyTicketSales(eventId: string, period: DashboardSalesPeriod = 'today') {
    await assertEventExists(eventId);
    const hourly_ticket_sales = await buildHourlyTicketSales(eventId, period);
    return {
      event_id: eventId,
      period,
      timezone: DASHBOARD_TIMEZONE,
      hourly_ticket_sales,
    };
  },

  async getDashboardPanels(eventId: string, period: DashboardSalesPeriod) {
    await assertEventExists(eventId);
    const window = salesPeriodWindow(period);
    const [top_bar_items, tickets_by_category, recent_activity] = await Promise.all([
      buildTopBarItems(eventId, window),
      buildTicketsByCategory(eventId, window),
      buildRecentActivity(eventId, window),
    ]);

    return {
      event_id: eventId,
      period,
      top_bar_items,
      tickets_by_category,
      recent_activity,
    };
  },

  parseSalesPeriod,
};
