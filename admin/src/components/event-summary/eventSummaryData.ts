import type { AdminDashboardActivity } from '../../api/client';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type EventSummaryPurchaseRow = {
  id: string;
  name: string;
  product: string;
  price: string;
  timeLabel: string;
};

export type EventSummaryQrRow = {
  id: string;
  name: string;
  accessType: string;
  timeLabel: string;
  valid: boolean;
};

function formatTimeLabel(iso: string, locale: string, t: Translate) {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (isToday) {
    return t('eventSummary.todayAt', { time });
  }

  const day = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);

  return t('eventSummary.dateAt', { day, time });
}

function purchaseProductLabel(activity: AdminDashboardActivity, t: Translate) {
  if (activity.kind === 'ticket_purchase') {
    const offering = activity.offering_name ?? activity.subtitle ?? 'Ticket';
    const quantity = activity.quantity ?? 1;
    if (quantity > 1) {
      return t('eventSummary.purchaseProductMultiple', {
        count: String(quantity),
        product: offering,
      });
    }
    return offering;
  }

  const product = activity.product_name ?? activity.subtitle ?? 'Product';
  const quantity = activity.quantity ?? 1;
  if (quantity > 1) {
    return t('eventSummary.purchaseProductMultiple', {
      count: String(quantity),
      product,
    });
  }
  return product;
}

export function splitSummaryActivity(
  activities: AdminDashboardActivity[],
  t: Translate,
  dateLocale: string,
): {
  purchases: EventSummaryPurchaseRow[];
  redemptions: EventSummaryQrRow[];
} {
  const purchases: EventSummaryPurchaseRow[] = [];
  const redemptions: EventSummaryQrRow[] = [];

  for (const activity of activities) {
    if (activity.kind === 'ticket_purchase' || activity.kind === 'drink_purchase') {
      purchases.push({
        id: activity.id,
        name: activity.actor_name,
        product: purchaseProductLabel(activity, t),
        price: '—',
        timeLabel: formatTimeLabel(activity.occurred_at, dateLocale, t),
      });
      continue;
    }

    if (activity.kind === 'drink_redemption' || activity.kind === 'ticket_redemption') {
      redemptions.push({
        id: activity.id,
        name: activity.actor_name,
        accessType: activity.zone_name ?? activity.subtitle ?? activity.product_name ?? '—',
        timeLabel: formatTimeLabel(activity.occurred_at, dateLocale, t),
        valid: true,
      });
    }
  }

  return {
    purchases: purchases.slice(0, 5),
    redemptions: redemptions.slice(0, 5),
  };
}

export function formatDeltaPct(deltaPct: number | null) {
  if (deltaPct === null) {
    return '0';
  }
  const sign = deltaPct > 0 ? '+' : '';
  return `${sign}${deltaPct}`;
}

export function formatEventCurrency(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function summaryKpiDeltaLabel(deltaPct: number | null, t: Translate) {
  if (deltaPct === null) {
    return t('dashboard.allTimeTotal');
  }
  return t('dashboard.deltaVsYesterday', {
    value: formatDeltaPct(deltaPct),
  });
}

export function summaryKpiDeltaTone(deltaPct: number | null): 'neutral' | 'positive' | 'negative' {
  if (deltaPct === null) {
    return 'neutral';
  }
  return deltaPct >= 0 ? 'positive' : 'negative';
}
