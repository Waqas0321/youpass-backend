import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi, type AdminEvent, type AdminEventDashboard } from '../api/client';
import { DashboardSalesChart, type HourlySalesPoint } from '../components/dashboard/DashboardSalesChart';
import { resolveDashboardKpis } from '../components/dashboard/dashboardData';
import { EventSummaryKpiCard } from '../components/event-summary/EventSummaryKpiCard';
import { EventSummaryLists } from '../components/event-summary/EventSummaryLists';
import { EventSummaryStatusBar } from '../components/event-summary/EventSummaryStatusBar';
import {
  formatDeltaPct,
  formatEventCurrency,
  splitSummaryActivity,
  summaryKpiDeltaLabel,
  summaryKpiDeltaTone,
} from '../components/event-summary/eventSummaryData';
import { eventDisplayBadge, canToggleEventSales } from '../components/events/eventsUtils';
import { EventWorkspaceLayout } from '../components/event-workspace/EventWorkspaceLayout';
import { Alert } from '../components/ui/Alert';
import {
  IconBell,
  IconChevronRight,
  IconDrink,
  IconDollar,
  IconTicket,
  IconUsers,
} from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { useI18n } from '../i18n/useI18n';

const ZERO_HOURLY: HourlySalesPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));

const EMPTY_DASHBOARD: AdminEventDashboard = {
  event_id: '',
  currency: 'CLP',
  kpis: {
    tickets_sold: { value: 0, delta_pct: 0, sparkline: [0, 0] },
    total_revenue: { value: 0, delta_pct: 0, sparkline: [0, 0] },
    bar_consumption: { value: 0, delta_pct: 0, sparkline: [0, 0] },
    active_users: { value: 0, delta_pct: 0, sparkline: [0, 0] },
  },
  hourly_ticket_sales: ZERO_HOURLY,
  hourly_ticket_sales_last_24h: ZERO_HOURLY,
  hourly_ticket_sales_by_period: {
    today: ZERO_HOURLY,
    yesterday: ZERO_HOURLY,
    last_7_days: ZERO_HOURLY,
    all_time: ZERO_HOURLY,
  },
  top_bar_items: [],
  tickets_by_category: [],
  recent_activity: [],
};

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function resolveHourlySalesLast24h(dashboard: AdminEventDashboard): HourlySalesPoint[] {
  return dashboard.hourly_ticket_sales_last_24h ?? dashboard.hourly_ticket_sales ?? ZERO_HOURLY;
}

export function EventSummaryPage() {
  const { eventId = '' } = useParams();
  const { t, numberLocale, dateLocale } = useI18n();
  const { setSelectedEventId } = useSelectedEvent();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [dashboard, setDashboard] = useState<AdminEventDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salesPaused, setSalesPaused] = useState(false);
  const [salesToggleLoading, setSalesToggleLoading] = useState(false);
  const [salesError, setSalesError] = useState('');

  useEffect(() => {
    if (eventId) {
      setSelectedEventId(eventId);
    }
  }, [eventId, setSelectedEventId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError('');

      const [eventsResult, dashboardResult] = await Promise.all([
        adminApi.events(),
        adminApi.eventDashboard(eventId),
      ]);

      if (cancelled) return;

      if (!eventsResult.ok) {
        setLoading(false);
        setError(eventsResult.error ?? t('eventSummary.loadError'));
        return;
      }

      const matched = eventsResult.data?.events.find((item) => item.id === eventId) ?? null;
      setEvent(matched);
      setSalesPaused(Boolean(matched?.sales_paused));

      if (!dashboardResult.ok) {
        setLoading(false);
        setError(dashboardResult.error ?? t('eventSummary.loadError'));
        return;
      }

      setDashboard(dashboardResult.data ?? EMPTY_DASHBOARD);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, t]);

  const currency = dashboard.currency || event?.currency_code || 'CLP';
  const allTimeKpis = useMemo(() => resolveDashboardKpis(dashboard, 'all_time'), [dashboard]);
  const todayKpis = useMemo(() => resolveDashboardKpis(dashboard, 'today'), [dashboard]);

  const ticketsSold = allTimeKpis.tickets_sold.value;
  const capacityTotal = event?.capacity_total ?? null;
  const capacityAvailable =
    event?.capacity_available ??
    (capacityTotal !== null ? Math.max(capacityTotal - ticketsSold, 0) : null);
  const ticketsPct =
    capacityTotal && capacityTotal > 0 ? Math.round((ticketsSold / capacityTotal) * 100) : null;
  const remainingPct =
    capacityTotal && capacityAvailable !== null && capacityTotal > 0
      ? Math.round((capacityAvailable / capacityTotal) * 100)
      : null;

  const { purchases, redemptions } = useMemo(
    () => splitSummaryActivity(dashboard.recent_activity, t, dateLocale),
    [dashboard.recent_activity, t, dateLocale],
  );

  const hourlySalesLast24h = useMemo(() => resolveHourlySalesLast24h(dashboard), [dashboard]);

  const hasSalesData =
    ticketsSold > 0 ||
    allTimeKpis.total_revenue.value > 0 ||
    allTimeKpis.bar_consumption.value > 0 ||
    purchases.length > 0 ||
    redemptions.length > 0;

  const badge = event ? eventDisplayBadge(event) : null;
  const dateLabel = event
    ? new Intl.DateTimeFormat(dateLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(event.starts_at))
    : '';
  const timeLabel = event
    ? new Intl.DateTimeFormat(dateLocale, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(event.starts_at))
    : '';
  const locationLabel =
    event?.location_display ?? (event ? `${event.venue_name ?? ''}, ${event.city}`.trim() : '');
  const capacityLabel =
    capacityTotal !== null
      ? t('eventSummary.totalCapacity', {
          value: formatCount(capacityTotal, numberLocale),
        })
      : null;

  const salesToggleDisabled = !event || !canToggleEventSales(event);

  async function handleToggleSales() {
    if (!event || salesToggleDisabled || salesToggleLoading) {
      return;
    }

    const nextPaused = !salesPaused;
    if (nextPaused && !window.confirm(t('eventSummary.pauseSalesConfirm'))) {
      return;
    }

    setSalesToggleLoading(true);
    setSalesError('');

    const result = await adminApi.setEventSalesPaused(eventId, nextPaused);
    setSalesToggleLoading(false);

    if (!result.ok) {
      setSalesError(result.error ?? t('eventSummary.salesToggleError'));
      return;
    }

    const paused = result.data?.sales_paused ?? nextPaused;
    setSalesPaused(paused);
    setEvent((current) => (current ? { ...current, sales_paused: paused } : current));
  }

  const layoutProps = {
    event,
    pageTitle: t('eventSummary.title'),
    pageSubtitle: t('eventSummary.subtitle'),
  };

  if (loading) {
    return (
      <EventWorkspaceLayout {...layoutProps}>
        <LoadingBlock label={t('eventSummary.loading')} />
      </EventWorkspaceLayout>
    );
  }

  if (error) {
    return (
      <EventWorkspaceLayout {...layoutProps}>
        <Alert tone="error">{error}</Alert>
      </EventWorkspaceLayout>
    );
  }

  const revenueDelta = allTimeKpis.total_revenue.delta_pct;
  const barDelta = allTimeKpis.bar_consumption.delta_pct;
  const ticketsTodayDelta = todayKpis.tickets_sold.delta_pct;
  const revenueTodayDelta = todayKpis.total_revenue.delta_pct;

  return (
    <EventWorkspaceLayout {...layoutProps}>
      <div className="event-summary">
        {salesError ? (
          <Alert tone="error" className="event-summary__sales-error">
            {salesError}
          </Alert>
        ) : null}

        <EventSummaryStatusBar
          badge={badge}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          locationLabel={locationLabel}
          capacityLabel={capacityLabel}
          salesPaused={salesPaused}
          salesToggleDisabled={salesToggleDisabled}
          salesToggleLoading={salesToggleLoading}
          onToggleSales={() => {
            void handleToggleSales();
          }}
        />

        {!hasSalesData ? (
          <div className="alert alert--info event-summary__empty-banner">
            <strong>{t('eventSummary.noSalesTitle')}</strong>
            <p>{t('eventSummary.noSalesBody')}</p>
          </div>
        ) : null}

        <div className="event-summary__kpi-grid">
          <EventSummaryKpiCard
            label={t('eventSummary.kpiTicketsSold')}
            value={formatCount(ticketsSold, numberLocale)}
            hint={
              ticketsPct !== null
                ? t('eventSummary.capacityShareAforo', { value: String(ticketsPct) })
                : t('eventsPage.noCapacityData')
            }
            icon={<IconTicket />}
            variant="progress"
            progressPct={ticketsPct ?? 0}
          />
          <EventSummaryKpiCard
            label={t('eventSummary.kpiTotalRevenue')}
            value={formatEventCurrency(allTimeKpis.total_revenue.value, numberLocale, currency)}
            hint={summaryKpiDeltaLabel(revenueDelta, t)}
            hintTone={summaryKpiDeltaTone(revenueDelta)}
            icon={<IconDollar />}
            variant="sparkline"
            sparkline={todayKpis.total_revenue.sparkline}
          />
          <EventSummaryKpiCard
            label={t('eventSummary.kpiRemainingCapacity')}
            value={capacityAvailable !== null ? formatCount(capacityAvailable, numberLocale) : '—'}
            hint={
              remainingPct !== null
                ? t('eventSummary.remainingShare', { value: String(remainingPct) })
                : t('eventsPage.noCapacityData')
            }
            icon={<IconUsers />}
            variant="progress"
            progressPct={remainingPct ?? 0}
          />
          <EventSummaryKpiCard
            label={t('eventSummary.kpiBarConsumption')}
            value={formatCount(allTimeKpis.bar_consumption.value, numberLocale)}
            hint={summaryKpiDeltaLabel(barDelta, t)}
            hintTone={summaryKpiDeltaTone(barDelta)}
            icon={<IconDrink />}
            variant="sparkline"
            sparkline={todayKpis.bar_consumption.sparkline}
          />
        </div>

        <section className="event-summary__main-grid">
          <div className="event-summary__chart-panel">
            <DashboardSalesChart
              hourlySales={hourlySalesLast24h}
              title={t('dashboard.ticketSalesLast24Hours')}
              compact
              showInfo={false}
            />
            <div className="event-summary__chart-foot">
              <div className="event-summary__chart-stat">
                <span>{t('eventSummary.ticketsSoldToday')}</span>
                <strong>{formatCount(todayKpis.tickets_sold.value, numberLocale)}</strong>
                <em
                  className={`event-summary__chart-delta event-summary__chart-delta--${
                    ticketsTodayDelta !== null && ticketsTodayDelta < 0 ? 'down' : 'up'
                  }`}
                >
                  {t('dashboard.deltaVsYesterday', {
                    value: formatDeltaPct(ticketsTodayDelta),
                  })}
                </em>
              </div>
              <div className="event-summary__chart-stat">
                <span>{t('eventSummary.revenueTodayLabel')}</span>
                <strong>
                  {formatEventCurrency(todayKpis.total_revenue.value, numberLocale, currency)}
                </strong>
                <em
                  className={`event-summary__chart-delta event-summary__chart-delta--${
                    revenueTodayDelta !== null && revenueTodayDelta < 0 ? 'down' : 'up'
                  }`}
                >
                  {t('dashboard.deltaVsYesterday', {
                    value: formatDeltaPct(revenueTodayDelta),
                  })}
                </em>
              </div>
            </div>
          </div>

          <EventSummaryLists eventId={eventId} purchases={purchases} redemptions={redemptions} />
        </section>

        <footer className="event-summary__footer-banner">
          <span className="event-summary__footer-icon" aria-hidden="true">
            <IconBell />
          </span>
          <div>
            <strong>
              {hasSalesData ? t('eventSummary.allGoodTitle') : t('eventSummary.noSalesFooterTitle')}
            </strong>
            <p>{hasSalesData ? t('eventSummary.allGoodBody') : t('eventSummary.noSalesFooterBody')}</p>
          </div>
          <Link to={`/events/${eventId}/analytics`} className="event-summary__analytics-link">
            {t('eventSummary.viewFullAnalytics')}
            <IconChevronRight />
          </Link>
        </footer>
      </div>
    </EventWorkspaceLayout>
  );
}
