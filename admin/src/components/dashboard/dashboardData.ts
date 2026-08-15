import type {
  AdminDashboardActivity,
  AdminDashboardTicketCategory,
  AdminDashboardTopBarItem,
  AdminEventDashboard,
  AdminEventDashboardKpis,
  AdminEventDashboardPanels,
  DashboardSalesPeriod,
} from '../../api/client';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type DashboardActivityItem = {
  id: string;
  icon: 'ticket' | 'drink' | 'table' | 'qr' | 'user';
  title: string;
  subtitle?: string;
  minutesAgo: number;
};

export const DASHBOARD_SALES_PERIODS: DashboardSalesPeriod[] = [
  'today',
  'yesterday',
  'last_7_days',
  'all_time',
];

export const DASHBOARD_PERIOD_LABEL_KEYS: Record<
  DashboardSalesPeriod,
  | 'dashboard.todayFilter'
  | 'dashboard.yesterdayFilter'
  | 'dashboard.last7DaysFilter'
  | 'dashboard.allTimeFilter'
> = {
  today: 'dashboard.todayFilter',
  yesterday: 'dashboard.yesterdayFilter',
  last_7_days: 'dashboard.last7DaysFilter',
  all_time: 'dashboard.allTimeFilter',
};

export function resolveDashboardKpis(
  dashboard: AdminEventDashboard,
  period: DashboardSalesPeriod,
): AdminEventDashboardKpis {
  return dashboard.kpis_by_period?.[period] ?? dashboard.kpis;
}

export function dashboardKpiDeltaLabel(
  period: DashboardSalesPeriod,
  deltaPct: number | null,
  t: Translate,
): string {
  if (deltaPct === null) {
    return t('dashboard.allTimeTotal');
  }
  const value = deltaPct > 0 ? `+${deltaPct}` : String(deltaPct);
  if (period === 'last_7_days') {
    return t('dashboard.deltaVsPrevious7Days', { value });
  }
  if (period === 'yesterday') {
    return t('dashboard.deltaVsDayBefore', { value });
  }
  return t('dashboard.deltaVsYesterday', { value });
}

export function dashboardKpiDeltaPositive(deltaPct: number | null): boolean {
  return deltaPct === null || deltaPct >= 0;
}

const DASHBOARD_KPI_SPARKLINE_PERIODS: DashboardSalesPeriod[] = ['today', 'yesterday'];

export function shouldShowDashboardKpiSparkline(period: DashboardSalesPeriod): boolean {
  return DASHBOARD_KPI_SPARKLINE_PERIODS.includes(period);
}

export function resolveDashboardKpiSparkline(
  period: DashboardSalesPeriod,
  sparkline: number[],
): number[] {
  return shouldShowDashboardKpiSparkline(period) ? sparkline : [];
}

export function pickDefaultDashboardPeriod(
  hourlyByPeriod: Record<DashboardSalesPeriod, Array<{ hour: number; value: number }>>,
): DashboardSalesPeriod {
  for (const period of DASHBOARD_SALES_PERIODS) {
    const total = hourlyByPeriod[period].reduce((sum, point) => sum + point.value, 0);
    if (total > 0) {
      return period;
    }
  }
  return 'all_time';
}

export function resolveHourlySales(apiHourly: Array<{ hour: number; value: number }>) {
  if (apiHourly.length === 24) {
    return apiHourly;
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = apiHourly.find((point) => point.hour === hour);
    return { hour, value: bucket?.value ?? 0 };
  });
}

export function resolveTopProducts(items: AdminDashboardTopBarItem[]) {
  return items.map((item) => ({
    id: item.product_id ?? item.name,
    name: item.name,
    count: item.count,
  }));
}

export function resolveCategorySlices(categories: AdminDashboardTicketCategory[]) {
  return categories.map((category) => ({
    id: category.offering_id ?? category.type,
    label: category.label,
    value: category.count,
  }));
}

export function resolveDashboardTopBarItems(
  dashboard: AdminEventDashboard,
  period: DashboardSalesPeriod,
): AdminDashboardTopBarItem[] {
  if (dashboard.top_bar_items_by_period) {
    return dashboard.top_bar_items_by_period[period] ?? [];
  }
  return period === 'all_time' ? dashboard.top_bar_items : [];
}

export function resolveDashboardTicketCategories(
  dashboard: AdminEventDashboard,
  period: DashboardSalesPeriod,
): AdminDashboardTicketCategory[] {
  if (dashboard.tickets_by_category_by_period) {
    return dashboard.tickets_by_category_by_period[period] ?? [];
  }
  return period === 'all_time' ? dashboard.tickets_by_category : [];
}

export function resolveDashboardRecentActivity(
  dashboard: AdminEventDashboard,
  period: DashboardSalesPeriod,
): AdminDashboardActivity[] {
  if (dashboard.recent_activity_by_period) {
    return dashboard.recent_activity_by_period[period] ?? [];
  }
  return period === 'all_time' ? dashboard.recent_activity : [];
}

export function readDashboardPanelsFromCache(
  dashboard: AdminEventDashboard,
  period: DashboardSalesPeriod,
): AdminEventDashboardPanels | null {
  if (!dashboard.top_bar_items_by_period) {
    return null;
  }

  return {
    event_id: dashboard.event_id,
    period,
    top_bar_items: dashboard.top_bar_items_by_period[period] ?? [],
    tickets_by_category: dashboard.tickets_by_category_by_period?.[period] ?? [],
    recent_activity: dashboard.recent_activity_by_period?.[period] ?? [],
  };
}

function activityToItem(activity: AdminDashboardActivity, t: Translate): DashboardActivityItem {
  const minutesAgo = Math.max(
    1,
    Math.round((Date.now() - new Date(activity.occurred_at).getTime()) / 60000),
  );

  switch (activity.kind) {
    case 'ticket_purchase': {
      const ticketLabel = activity.offering_name ?? t('dashboard.categories.general');
      const title =
        (activity.quantity ?? 1) > 1
          ? t('dashboard.activityTicketMultiple', {
              name: activity.actor_name,
              count: String(activity.quantity ?? 1),
              ticket: ticketLabel,
            })
          : t('dashboard.activityTicketSingle', {
              name: activity.actor_name,
              ticket: ticketLabel,
            });
      return {
        id: activity.id,
        icon: 'ticket',
        title,
        subtitle: ticketLabel,
        minutesAgo,
      };
    }
    case 'drink_purchase': {
      const product = activity.product_name ?? '';
      const title =
        (activity.quantity ?? 1) > 1
          ? t('dashboard.activityMultiple', {
              name: activity.actor_name,
              count: String(activity.quantity ?? 1),
              product,
            })
          : t('dashboard.activitySingle', {
              name: activity.actor_name,
              product,
            });
      return {
        id: activity.id,
        icon: 'drink',
        title,
        subtitle: activity.subtitle ?? product,
        minutesAgo,
      };
    }
    case 'drink_redemption':
    case 'ticket_redemption':
      return {
        id: activity.id,
        icon: 'qr',
        title: t('dashboard.activityQrRedeemed'),
        subtitle: activity.subtitle ?? activity.product_name,
        minutesAgo,
      };
    case 'table_assigned':
      return {
        id: activity.id,
        icon: 'table',
        title: t('dashboard.activityTableAssigned', {
          table: activity.table_label ?? '',
        }),
        subtitle: activity.zone_name ?? activity.subtitle,
        minutesAgo,
      };
    default:
      return {
        id: activity.id,
        icon: 'ticket',
        title: activity.actor_name,
        subtitle: activity.subtitle,
        minutesAgo,
      };
  }
}

export function resolveActivityItems(
  activities: AdminDashboardActivity[],
  t: Translate,
): DashboardActivityItem[] {
  return activities.map((activity) => activityToItem(activity, t));
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = MINUTES_PER_HOUR * 24;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const MINUTES_PER_MONTH = MINUTES_PER_DAY * 30;
const MINUTES_PER_YEAR = MINUTES_PER_DAY * 365;

export function formatMinutesAgo(minutesAgo: number, locale: string) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.max(1, Math.round(minutesAgo));

  if (minutes < MINUTES_PER_HOUR) {
    return rtf.format(-minutes, 'minute');
  }

  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < 24) {
    return rtf.format(-hours, 'hour');
  }

  const days = Math.round(minutes / MINUTES_PER_DAY);
  if (days < 7) {
    return rtf.format(-days, 'day');
  }

  const weeks = Math.round(minutes / MINUTES_PER_WEEK);
  if (weeks < 5) {
    return rtf.format(-weeks, 'week');
  }

  const months = Math.round(minutes / MINUTES_PER_MONTH);
  if (months < 12) {
    return rtf.format(-months, 'month');
  }

  const years = Math.round(minutes / MINUTES_PER_YEAR);
  return rtf.format(-years, 'year');
}
