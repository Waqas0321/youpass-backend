import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminEvent, type AdminEventDashboard, type DashboardSalesPeriod } from '../../api/client';
import { buildEventAnalyticsView, type EventAnalyticsView } from './buildEventAnalyticsView';
import { EventAnalyticsBehaviorGrid } from './EventAnalyticsBehaviorGrid';
import { EventAnalyticsDonutPanel } from './EventAnalyticsDonutPanel';
import { EventAnalyticsKpiCard } from './EventAnalyticsKpiCard';
import { EventAnalyticsProductRankPanel } from './EventAnalyticsProductRankPanel';
import { EventAnalyticsRankPanel } from './EventAnalyticsRankPanel';
import { formatZoneRevenue } from './formatAnalyticsDelta';
import { EventAnalyticsZoneBars } from './EventAnalyticsZoneBars';
import { formatAnalyticsCurrency, formatAnalyticsDelta, formatAnalyticsPercent } from './formatAnalyticsDelta';
import { EventAnalyticsSalesChart } from './EventAnalyticsSalesChart';
import { EventAnalyticsToolbar } from './EventAnalyticsToolbar';
import { Alert } from '../ui/Alert';
import {
  IconChart,
  IconClock,
  IconDollar,
  IconTicket,
  IconUsers,
} from '../ui/Icons';
import { LoadingBlock } from '../ui/LoadingBlock';
import { useI18n } from '../../i18n/useI18n';

const EMPTY_DASHBOARD: AdminEventDashboard = {
  event_id: '',
  currency: 'CLP',
  kpis: {
    tickets_sold: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    total_revenue: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    bar_consumption: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    active_users: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
  },
  hourly_ticket_sales: Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 })),
  hourly_ticket_sales_by_period: {
    today: Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 })),
    yesterday: Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 })),
    last_7_days: Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 })),
    all_time: Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 })),
  },
  top_bar_items: [],
  tickets_by_category: [],
  recent_activity: [],
};

function formatDuration(minutes: number | null) {
  if (minutes == null || minutes <= 0) {
    return '—';
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

type Props = {
  eventId: string;
  event?: AdminEvent | null;
  onAnalyticsChange?: (view: EventAnalyticsView | null, period: DashboardSalesPeriod) => void;
};

export function EventAnalyticsContent({ eventId, event: eventProp = null, onAnalyticsChange }: Props) {
  const { t, numberLocale, dateLocale } = useI18n();
  const [event, setEvent] = useState<AdminEvent | null>(eventProp);
  const [dashboard, setDashboard] = useState<AdminEventDashboard>(EMPTY_DASHBOARD);
  const [period, setPeriod] = useState<DashboardSalesPeriod>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setEvent(eventProp);
  }, [eventProp]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const dashboardResult = await adminApi.eventDashboard(eventId);

      if (cancelled) {
        return;
      }

      if (!dashboardResult.ok || !dashboardResult.data) {
        setLoading(false);
        setError(dashboardResult.error ?? t('eventAnalytics.loadError'));
        return;
      }

      if (!eventProp) {
        const eventsResult = await adminApi.events();
        if (cancelled) {
          return;
        }

        setEvent(
          eventsResult.ok && eventsResult.data
            ? eventsResult.data.events.find((item: AdminEvent) => item.id === eventId) ?? null
            : null,
        );
      }

      const nextDashboard = dashboardResult.data;
      setDashboard(nextDashboard);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, eventProp, t]);

  const analytics = useMemo(() => {
    if (!event) {
      return null;
    }

    return buildEventAnalyticsView(dashboard, event, dateLocale, period, t);
  }, [dashboard, event, dateLocale, period, t]);

  useEffect(() => {
    onAnalyticsChange?.(analytics, period);
  }, [analytics, onAnalyticsChange, period]);

  function deltaLabel(deltaPct: number) {
    return t('eventAnalytics.deltaVsPrevious', {
      value: formatAnalyticsDelta(deltaPct, numberLocale),
    });
  }

  return (
    <section className="event-analytics">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <LoadingBlock label={t('eventAnalytics.loading')} />
      ) : analytics ? (
        <>
          <EventAnalyticsToolbar
            period={period}
            dateRangeLabel={analytics.dateRangeLabel}
            onPeriodChange={setPeriod}
          />

          <div className="event-analytics__kpi-grid">
            <EventAnalyticsKpiCard
              tone="purple"
              label={t('eventAnalytics.kpiTotalSales')}
              value={formatAnalyticsCurrency(
                analytics.kpis.totalSales.value,
                numberLocale,
                analytics.currency,
              )}
              deltaPct={analytics.kpis.totalSales.delta_pct ?? 0}
              deltaLabel={deltaLabel(analytics.kpis.totalSales.delta_pct ?? 0)}
              icon={<IconDollar />}
            />
            <EventAnalyticsKpiCard
              tone="blue"
              label={t('eventAnalytics.kpiUniqueUsers')}
              value={new Intl.NumberFormat(numberLocale).format(analytics.kpis.uniqueUsers.value)}
              deltaPct={analytics.kpis.uniqueUsers.delta_pct ?? 0}
              deltaLabel={deltaLabel(analytics.kpis.uniqueUsers.delta_pct ?? 0)}
              icon={<IconUsers />}
            />
            <EventAnalyticsKpiCard
              tone="green"
              label={t('eventAnalytics.kpiSellThrough')}
              value={
                analytics.kpis.sellThroughPct == null
                  ? '—'
                  : formatAnalyticsPercent(analytics.kpis.sellThroughPct, numberLocale)
              }
              deltaPct={analytics.kpis.sellThroughDeltaPct ?? 0}
              deltaLabel={deltaLabel(analytics.kpis.sellThroughDeltaPct ?? 0)}
              icon={<IconChart />}
            />
            <EventAnalyticsKpiCard
              tone="gold"
              label={t('eventAnalytics.kpiAverageTicket')}
              value={formatAnalyticsCurrency(
                analytics.kpis.avgTicket,
                numberLocale,
                analytics.currency,
              )}
              deltaPct={analytics.kpis.avgTicketDeltaPct}
              deltaLabel={deltaLabel(analytics.kpis.avgTicketDeltaPct)}
              icon={<IconTicket />}
            />
            <EventAnalyticsKpiCard
              tone="pink"
              label={t('eventAnalytics.kpiAverageStay')}
              value={formatDuration(analytics.kpis.avgStayMinutes)}
              deltaPct={analytics.kpis.avgStayDeltaPct}
              deltaLabel={deltaLabel(analytics.kpis.avgStayDeltaPct)}
              icon={<IconClock />}
            />
          </div>

          <section className="event-analytics__main-charts">
            <h2>{t('eventAnalytics.mainChartsTitle')}</h2>

            <div className="event-analytics__main-charts-grid">
              <EventAnalyticsSalesChart
                hourlySales={analytics.hourlyRevenue}
                title={t('eventAnalytics.salesPerHour')}
                currency={analytics.currency}
              />
              <EventAnalyticsDonutPanel
                title={t('eventAnalytics.ticketsByType')}
                emptyLabel={t('eventAnalytics.noTicketData')}
                slices={analytics.ticketsByType}
                palette="tickets"
              />
              <EventAnalyticsDonutPanel
                title={t('eventAnalytics.consumptionByCategory')}
                emptyLabel={t('eventAnalytics.noConsumptionData')}
                slices={analytics.consumptionByCategory}
                palette="consumption"
              />
              <EventAnalyticsZoneBars
                title={t('eventAnalytics.revenueByZone')}
                emptyLabel={t('eventAnalytics.noZoneData')}
                rows={analytics.revenueByZone}
                currency={analytics.currency}
              />
            </div>
          </section>

          <section className="event-analytics__insights-section">
            <div className="event-analytics__insights-grid">
              <EventAnalyticsDonutPanel
                title={t('eventAnalytics.paymentMethods')}
                emptyLabel={t('eventAnalytics.noPaymentData')}
                slices={analytics.paymentMethods}
                palette="payment"
                panelVariant="payment"
                centerDisplay={formatZoneRevenue(
                  analytics.paymentCenterTotal,
                  numberLocale,
                  analytics.currency,
                )}
              />
              <EventAnalyticsProductRankPanel
                title={t('eventAnalytics.productRankingTitle')}
                subtitle={t('eventAnalytics.topDrinksSubtitle')}
                emptyLabel={t('eventAnalytics.noProductData')}
                items={analytics.topProducts}
              />
            </div>
          </section>

          <section className="event-analytics__insights-section">
            <div className="event-analytics__insights-grid">
              <EventAnalyticsRankPanel
                title={t('eventAnalytics.topTicketsTitle')}
                emptyLabel={t('eventAnalytics.noTicketRankData')}
                items={analytics.topTickets}
                variant="tickets"
              />
              <EventAnalyticsRankPanel
                title={t('eventAnalytics.vipUsers')}
                emptyLabel={t('eventAnalytics.noVipData')}
                items={analytics.vipUsers}
                variant="vip"
              />
            </div>
          </section>

          <div className="event-analytics__behavior-section">
            <h2>{t('eventAnalytics.userBehaviorTitle')}</h2>
            <EventAnalyticsBehaviorGrid behavior={analytics.behavior} />
          </div>
        </>
      ) : (
        <Alert tone="info">{t('eventAnalytics.noEventData')}</Alert>
      )}
    </section>
  );
}
