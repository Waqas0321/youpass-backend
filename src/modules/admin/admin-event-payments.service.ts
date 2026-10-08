import type { EventDrinkOrderStatus, TicketCatalogType, TicketOrderStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { TYPE_LABELS } from '../ticket-offerings/ticket-offering.types.js';

const TIMEZONE = 'America/Santiago';
const DRINK_GROSS_STATUSES: EventDrinkOrderStatus[] = ['confirmed', 'redeemed'];
const TRANSACTION_LIMIT = 100;

const CATALOG_TYPE_LABELS: Record<TicketCatalogType, string> = {
  general: TYPE_LABELS.general,
  vip: TYPE_LABELS.vip_general,
  vip_table: 'VIP Table',
  courtesy: 'Courtesy',
  free: 'Free',
  discounted: 'Discounted',
};

type ChartPoint = { label: string; value: number };
type CategorySlice = { label: string; value: number };

type PaymentTransactionStatus = 'approved' | 'pending' | 'refunded';

type PaymentTransaction = {
  id: string;
  user: string;
  product: string;
  method: string;
  method_tone: 'webpay' | 'visa' | 'mastercard' | 'amex' | 'transfer';
  status: PaymentTransactionStatus;
  amount: number;
  date: string;
  created_at: string;
};

type PaymentKpi = {
  id: 'gross' | 'commission' | 'net' | 'refunds' | 'pendingSettlement';
  tone: 'purple' | 'gold' | 'green' | 'red' | 'blue';
  value: number;
  delta_pct: number;
  delta_tone: 'good' | 'bad' | 'neutral';
};

function roundClp(value: number) {
  return Math.round(value);
}

function dayKeyInTimezone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function chartLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone,
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatTxnDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function last7DayKeys(now = new Date()) {
  const keys: Array<{ key: string; label: string; date: Date }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push({
      key: dayKeyInTimezone(d, TIMEZONE),
      label: chartLabel(d, TIMEZONE),
      date: d,
    });
  }
  return keys;
}

function ticketProductLabel(type: TicketCatalogType, quantity: number) {
  const base = CATALOG_TYPE_LABELS[type] ?? type;
  return quantity > 1 ? `${base} ×${quantity}` : base;
}

function ticketTxnStatus(status: TicketOrderStatus): PaymentTransactionStatus | null {
  if (status === 'paid') return 'approved';
  if (status === 'pending_payment') return 'pending';
  if (status === 'refunded') return 'refunded';
  return null;
}

function drinkTxnStatus(status: EventDrinkOrderStatus): PaymentTransactionStatus | null {
  if (status === 'confirmed' || status === 'redeemed') return 'approved';
  if (status === 'refunded') return 'refunded';
  return null;
}

function categoryKeyForTicket(type: TicketCatalogType): string {
  if (type === 'vip' || type === 'vip_table') return 'vipTables';
  if (type === 'general' || type === 'discounted') return 'generalTickets';
  return 'other';
}

export const adminEventPaymentsService = {
  async getForEvent(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });
    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    }

    const [ticketOrders, drinkOrders] = await Promise.all([
      prisma.ticketOrder.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { fullName: true, phone: true } },
        },
      }),
      prisma.eventDrinkOrder.findMany({
        where: {
          eventId,
          isComplimentary: false,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, phone: true } },
          lines: {
            select: { productName: true, quantity: true },
            orderBy: { createdAt: 'asc' },
            take: 3,
          },
        },
      }),
    ]);

    let gross = 0;
    let commission = 0;
    let refunds = 0;
    const categoryTotals: Record<string, number> = {
      generalTickets: 0,
      vipTables: 0,
      drinks: 0,
      food: 0,
      other: 0,
    };

    const dayKeys = last7DayKeys();
    const salesByDay = new Map(dayKeys.map((d) => [d.key, 0]));
    const refundsByDay = new Map(dayKeys.map((d) => [d.key, 0]));

    const transactions: PaymentTransaction[] = [];

    for (const order of ticketOrders) {
      const amount = roundClp(order.totalAmount);
      const fee = roundClp(order.serviceFeeAmount);
      const status = ticketTxnStatus(order.status);
      const day = dayKeyInTimezone(order.createdAt, TIMEZONE);

      if (order.status === 'paid') {
        gross += amount;
        commission += fee;
        categoryTotals[categoryKeyForTicket(order.type)] += amount;
        if (salesByDay.has(day)) {
          salesByDay.set(day, (salesByDay.get(day) ?? 0) + amount);
        }
      } else if (order.status === 'refunded') {
        refunds += amount;
        if (refundsByDay.has(day)) {
          refundsByDay.set(day, (refundsByDay.get(day) ?? 0) + amount);
        }
      }

      if (status) {
        transactions.push({
          id: order.id,
          user: order.buyer.fullName?.trim() || order.buyer.phone || '—',
          product: ticketProductLabel(order.type, order.quantity),
          method: order.paymentReference ? 'Card' : 'Gateway',
          method_tone: 'webpay',
          status,
          amount,
          date: formatTxnDate(order.createdAt, TIMEZONE),
          created_at: order.createdAt.toISOString(),
        });
      }
    }

    for (const order of drinkOrders) {
      const amount = order.totalClp;
      const fee = order.serviceFeeClp;
      const status = drinkTxnStatus(order.status);
      const day = dayKeyInTimezone(order.createdAt, TIMEZONE);

      if (DRINK_GROSS_STATUSES.includes(order.status)) {
        gross += amount;
        commission += fee;
        categoryTotals.drinks += amount;
        if (salesByDay.has(day)) {
          salesByDay.set(day, (salesByDay.get(day) ?? 0) + amount);
        }
      } else if (order.status === 'refunded') {
        refunds += amount;
        if (refundsByDay.has(day)) {
          refundsByDay.set(day, (refundsByDay.get(day) ?? 0) + amount);
        }
      }

      if (status) {
        const firstLine = order.lines[0]?.productName;
        const product =
          order.lines.length > 1
            ? `${firstLine ?? 'Drinks'} (+${order.lines.length - 1})`
            : firstLine ?? `Drinks ×${order.itemCount}`;

        transactions.push({
          id: order.id,
          user: order.user.fullName?.trim() || order.user.phone || '—',
          product,
          method: 'Card',
          method_tone: 'webpay',
          status,
          amount,
          date: formatTxnDate(order.createdAt, TIMEZONE),
          created_at: order.createdAt.toISOString(),
        });
      }
    }

    transactions.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const limitedTransactions = transactions.slice(0, TRANSACTION_LIMIT);

    const net = Math.max(0, gross - commission);
    const pendingSettlement = net;

    const kpis: PaymentKpi[] = [
      { id: 'gross', tone: 'purple', value: gross, delta_pct: 0, delta_tone: 'neutral' },
      { id: 'commission', tone: 'gold', value: commission, delta_pct: 0, delta_tone: 'neutral' },
      { id: 'net', tone: 'green', value: net, delta_pct: 0, delta_tone: 'neutral' },
      { id: 'refunds', tone: 'red', value: refunds, delta_pct: 0, delta_tone: 'neutral' },
      {
        id: 'pendingSettlement',
        tone: 'blue',
        value: pendingSettlement,
        delta_pct: 0,
        delta_tone: 'neutral',
      },
    ];

    const dailySales: ChartPoint[] = dayKeys.map((d) => ({
      label: d.label,
      value: salesByDay.get(d.key) ?? 0,
    }));
    const refundSeries: ChartPoint[] = dayKeys.map((d) => ({
      label: d.label,
      value: refundsByDay.get(d.key) ?? 0,
    }));

    const revenueByCategory: CategorySlice[] = Object.entries(categoryTotals)
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }));

    return {
      event: { id: event.id, title: event.title },
      kpis,
      daily_sales: dailySales,
      refunds_series: refundSeries,
      revenue_by_category: revenueByCategory,
      payment_methods: [] as CategorySlice[],
      method_summary: [] as Array<{
        method: string;
        method_tone: PaymentTransaction['method_tone'];
        count: number;
        share_pct: number;
        amount: number;
      }>,
      settlements: [] as Array<{
        id: string;
        date: string;
        status: 'transferred' | 'scheduled';
        amount: number;
        account_mask: string;
      }>,
      payment_methods_available: false,
      settlements_available: false,
      transactions: limitedTransactions,
    };
  },
};
