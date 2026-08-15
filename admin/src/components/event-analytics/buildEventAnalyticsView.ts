import type { AdminEvent, AdminEventDashboard, DashboardSalesPeriod } from '../../api/client';
import {
  DASHBOARD_PERIOD_LABEL_KEYS,
  resolveCategorySlices,
  resolveTopProducts,
} from '../dashboard/dashboardData';

export type AnalyticsSlice = { label: string; value: number };
export type AnalyticsRank = { name: string; count: number };
export type AnalyticsHourlyPoint = { hour: number; value: number };

export type EventAnalyticsBehavior = {
  peakEntryHour: string | null;
  peakEntryDeltaPct: number;
  peakEntryCurve: number[];
  peakConsumptionHour: string | null;
  peakConsumptionDeltaPct: number;
  peakConsumptionCurve: number[];
  recurringUsers: number;
  recurringSharePct: number;
  recurringDeltaPct: number;
  recurringCurve: number[];
  socialConversionPct: number | null;
  socialDeltaPct: number;
  socialCurve: number[];
};

export type EventAnalyticsView = {
  currency: string;
  hourlyRevenue: AnalyticsHourlyPoint[];
  paymentCenterTotal: number;
  kpis: {
    totalSales: AdminEventDashboard['kpis']['total_revenue'];
    uniqueUsers: AdminEventDashboard['kpis']['active_users'];
    sellThroughPct: number | null;
    sellThroughDeltaPct: number | null;
    avgTicket: number;
    avgTicketDeltaPct: number;
    avgStayMinutes: number | null;
    avgStayDeltaPct: number;
  };
  ticketsByType: AnalyticsSlice[];
  consumptionByCategory: AnalyticsSlice[];
  revenueByZone: AnalyticsSlice[];
  paymentMethods: AnalyticsSlice[];
  topProducts: AnalyticsRank[];
  topTickets: AnalyticsRank[];
  vipUsers: AnalyticsRank[];
  behavior: EventAnalyticsBehavior;
  dateRangeLabel: string;
};

/** Event-night hours shown on analytics charts (noon → 06:00). */
const EVENT_WINDOW_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];

function buildDateRangeLabel(
  event: AdminEvent,
  locale: string,
  period: DashboardSalesPeriod,
  t: (key: string) => string,
) {
  if (period !== 'all_time') {
    return t(DASHBOARD_PERIOD_LABEL_KEYS[period]);
  }

  const start = new Date(event.starts_at);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `${formatter.format(monthStart)} - ${formatter.format(monthEnd)}`;
}

function dashboardForPeriod(
  dashboard: AdminEventDashboard,
  period: DashboardSalesPeriod,
): AdminEventDashboard {
  return {
    ...dashboard,
    kpis: dashboard.kpis_by_period?.[period] ?? dashboard.kpis,
    hourly_revenue:
      dashboard.hourly_revenue_by_period?.[period] ??
      dashboard.hourly_revenue ??
      dashboard.hourly_ticket_sales_by_period?.[period],
    tickets_by_category:
      dashboard.tickets_by_category_by_period?.[period] ?? dashboard.tickets_by_category,
    consumption_by_category:
      dashboard.consumption_by_category_by_period?.[period] ?? dashboard.consumption_by_category,
    revenue_by_zone: dashboard.revenue_by_zone_by_period?.[period] ?? dashboard.revenue_by_zone,
    top_bar_items: dashboard.top_bar_items_by_period?.[period] ?? dashboard.top_bar_items,
    top_spenders: dashboard.top_spenders_by_period?.[period] ?? dashboard.top_spenders,
    behavior_insights:
      dashboard.behavior_insights_by_period?.[period] ?? dashboard.behavior_insights,
  };
}

function resolveHourlyRevenue(dashboard: AdminEventDashboard): AnalyticsHourlyPoint[] {
  const hourly =
    dashboard.hourly_revenue ??
    dashboard.hourly_revenue_by_period?.all_time ??
    dashboard.hourly_ticket_sales_by_period?.all_time ??
    dashboard.hourly_ticket_sales;

  if (hourly.length === 24) {
    return hourly;
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourly.find((point) => point.hour === hour);
    return { hour, value: bucket?.value ?? 0 };
  });
}

function mapZoneRevenue(rows: AdminEventDashboard['revenue_by_zone']): AnalyticsSlice[] {
  return (rows ?? []).map((row) => ({
    label: row.label,
    value: row.value,
  }));
}

function mapConsumption(rows: AdminEventDashboard['consumption_by_category']): AnalyticsSlice[] {
  return (rows ?? []).map((row) => ({
    label: row.label,
    value: row.value,
  }));
}

function formatPeakHour(hour: number | null | undefined) {
  if (hour == null) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:00`;
}

function extractEventWindowCurve(buckets: number[]) {
  return EVENT_WINDOW_HOURS.map((hour) => buckets[hour] ?? 0);
}

function averageDeltaPct(curve: number[]) {
  const total = curve.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return 0;
  }
  const peak = Math.max(...curve);
  const average = total / curve.length;
  if (average <= 0) {
    return 0;
  }
  return Math.round(((peak - average) / average) * 1000) / 10;
}

function buildBehavior(
  dashboard: AdminEventDashboard,
): EventAnalyticsBehavior {
  const insights = dashboard.behavior_insights;
  const entryCurve = extractEventWindowCurve(insights?.entry_by_hour ?? Array(24).fill(0));
  const consumptionCurve = extractEventWindowCurve(
    insights?.consumption_by_hour ?? Array(24).fill(0),
  );
  const recurringCurve = entryCurve.some((value) => value > 0)
    ? entryCurve
    : consumptionCurve;

  return {
    peakEntryHour: formatPeakHour(insights?.peak_entry_hour),
    peakEntryDeltaPct: averageDeltaPct(entryCurve),
    peakEntryCurve: entryCurve,
    peakConsumptionHour: formatPeakHour(insights?.peak_consumption_hour),
    peakConsumptionDeltaPct: averageDeltaPct(consumptionCurve),
    peakConsumptionCurve: consumptionCurve,
    recurringUsers: insights?.recurring_users ?? 0,
    recurringSharePct: insights?.recurring_share_pct ?? 0,
    recurringDeltaPct: 0,
    recurringCurve,
    socialConversionPct: insights?.social_conversion_pct ?? null,
    socialDeltaPct: 0,
    socialCurve: recurringCurve,
  };
}

export function buildEventAnalyticsView(
  dashboard: AdminEventDashboard,
  event: AdminEvent,
  locale: string,
  period: DashboardSalesPeriod = 'today',
  t: (key: string) => string = (key) => key,
): EventAnalyticsView {
  const scopedDashboard = dashboardForPeriod(dashboard, period);
  const ticketsSold = scopedDashboard.kpis.tickets_sold.value;
  const totalRevenue = scopedDashboard.kpis.total_revenue.value;
  const capacityTotal = event.capacity_total ?? null;

  const sellThroughPct =
    capacityTotal != null && capacityTotal > 0
      ? Math.min(100, Math.round((ticketsSold / capacityTotal) * 1000) / 10)
      : null;

  const ticketsByType = resolveCategorySlices(scopedDashboard.tickets_by_category);

  return {
    currency: scopedDashboard.currency || 'CLP',
    hourlyRevenue: resolveHourlyRevenue(scopedDashboard),
    paymentCenterTotal: totalRevenue,
    kpis: {
      totalSales: scopedDashboard.kpis.total_revenue,
      uniqueUsers: scopedDashboard.kpis.active_users,
      sellThroughPct,
      sellThroughDeltaPct: scopedDashboard.kpis.tickets_sold.delta_pct,
      avgTicket: ticketsSold > 0 ? Math.round(totalRevenue / ticketsSold) : 0,
      avgTicketDeltaPct: scopedDashboard.kpis.total_revenue.delta_pct ?? 0,
      avgStayMinutes: null,
      avgStayDeltaPct: scopedDashboard.kpis.bar_consumption.delta_pct ?? 0,
    },
    ticketsByType,
    consumptionByCategory: mapConsumption(scopedDashboard.consumption_by_category),
    revenueByZone: mapZoneRevenue(scopedDashboard.revenue_by_zone),
    paymentMethods: [],
    topProducts: resolveTopProducts(scopedDashboard.top_bar_items).map((item) => ({
      name: item.name,
      count: item.count,
    })),
    topTickets: [...ticketsByType]
      .sort((a, b) => b.value - a.value)
      .map((item) => ({ name: item.label, count: item.value })),
    vipUsers: (scopedDashboard.top_spenders ?? []).map((spender) => ({
      name: spender.name,
      count: spender.purchase_count,
    })),
    behavior: buildBehavior(scopedDashboard),
    dateRangeLabel: buildDateRangeLabel(event, locale, period, t),
  };
}
