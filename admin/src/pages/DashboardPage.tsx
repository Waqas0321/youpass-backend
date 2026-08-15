import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminEventDashboard, type AdminEventDashboardPanels, type DashboardSalesPeriod } from '../api/client';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { DashboardBody } from '../components/dashboard/DashboardBody';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard';
import type { HourlySalesPoint } from '../components/dashboard/DashboardSalesChart';
import { Alert } from '../components/ui/Alert';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import {
  IconDrink,
  IconTicket,
  IconTrending,
  IconUsers,
} from '../components/ui/Icons';
import { useI18n } from '../i18n/useI18n';
import {
  dashboardKpiDeltaLabel,
  dashboardKpiDeltaPositive,
  pickDefaultDashboardPeriod,
  readDashboardPanelsFromCache,
  resolveActivityItems,
  resolveCategorySlices,
  resolveDashboardKpiSparkline,
  resolveDashboardKpis,
  resolveTopProducts,
} from '../components/dashboard/dashboardData';

const EMPTY_PANELS: AdminEventDashboardPanels = {
  event_id: '',
  period: 'today',
  top_bar_items: [],
  tickets_by_category: [],
  recent_activity: [],
};

const ZERO_HOURLY: HourlySalesPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));

const EMPTY_HOURLY_BY_PERIOD = {
  today: ZERO_HOURLY,
  yesterday: ZERO_HOURLY,
  last_7_days: ZERO_HOURLY,
  all_time: ZERO_HOURLY,
};

const EMPTY_DASHBOARD: AdminEventDashboard = {
  event_id: '',
  currency: 'CLP',
  kpis: {
    tickets_sold: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    total_revenue: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    bar_consumption: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    active_users: { value: 0, delta_pct: 0, sparkline: [0, 0, 0, 0, 0, 0, 0] },
  },
  hourly_ticket_sales: ZERO_HOURLY,
  hourly_ticket_sales_last_24h: ZERO_HOURLY,
  hourly_ticket_sales_by_period: EMPTY_HOURLY_BY_PERIOD,
  top_bar_items: [],
  tickets_by_category: [],
  recent_activity: [],
};

function buildHourlyByPeriod(dashboard: AdminEventDashboard) {
  if (dashboard.hourly_ticket_sales_by_period) {
    return dashboard.hourly_ticket_sales_by_period;
  }

  return {
    ...EMPTY_HOURLY_BY_PERIOD,
    today: dashboard.hourly_ticket_sales ?? ZERO_HOURLY,
  };
}

function resolveHourlySalesLast24h(dashboard: AdminEventDashboard): HourlySalesPoint[] {
  return dashboard.hourly_ticket_sales_last_24h ?? dashboard.hourly_ticket_sales ?? ZERO_HOURLY;
}

function formatDashboardCurrency(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function DashboardPage() {
  const { t, numberLocale } = useI18n();
  const { selectedEvent, events, eventsLoading, setSelectedEventId } = useSelectedEvent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<AdminEventDashboard>(EMPTY_DASHBOARD);
  const [panels, setPanels] = useState<AdminEventDashboardPanels>(EMPTY_PANELS);
  const [salesPeriod, setSalesPeriod] = useState<DashboardSalesPeriod>('today');
  const lastEventIdForPeriod = useRef<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (eventsLoading) {
        return;
      }

      setLoading(true);
      setError('');

      const overviewResult = await adminApi.overview();
      if (cancelled) return;

      if (!overviewResult.ok) {
        setLoading(false);
        setError(overviewResult.error ?? t('dashboard.loadError'));
        return;
      }

      if (!selectedEvent) {
        setDashboard(EMPTY_DASHBOARD);
        setLoading(false);
        return;
      }

      const dashboardResult = await adminApi.eventDashboard(selectedEvent.id);
      if (cancelled) return;

      if (!dashboardResult.ok) {
        setLoading(false);
        setError(dashboardResult.error ?? t('dashboard.loadError'));
        return;
      }

      setDashboard(dashboardResult.data ?? EMPTY_DASHBOARD);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, eventsLoading]);

  const kpis = useMemo(
    () => resolveDashboardKpis(dashboard, salesPeriod),
    [dashboard, salesPeriod],
  );
  const hourlyByPeriod = useMemo(() => buildHourlyByPeriod(dashboard), [dashboard]);
  const hourlySalesLast24h = useMemo(() => resolveHourlySalesLast24h(dashboard), [dashboard]);

  useEffect(() => {
    const eventId = selectedEvent?.id;
    if (!eventId || loading) {
      return;
    }

    if (lastEventIdForPeriod.current !== eventId) {
      lastEventIdForPeriod.current = eventId;
      setSalesPeriod(pickDefaultDashboardPeriod(hourlyByPeriod));
    }
  }, [selectedEvent?.id, loading, hourlyByPeriod]);

  useEffect(() => {
    const eventId = selectedEvent?.id;
    if (!eventId || loading) {
      setPanels(EMPTY_PANELS);
      return;
    }

    const cached = readDashboardPanelsFromCache(dashboard, salesPeriod);
    if (cached) {
      setPanels(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await adminApi.eventDashboardPanels(eventId, salesPeriod);
      if (cancelled) {
        return;
      }
      if (result.ok && result.data) {
        setPanels(result.data);
        return;
      }
      setPanels({
        event_id: eventId,
        period: salesPeriod,
        top_bar_items: [],
        tickets_by_category: [],
        recent_activity: [],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEvent?.id, salesPeriod, dashboard, loading]);

  const topProducts = useMemo(
    () => resolveTopProducts(panels.top_bar_items),
    [panels.top_bar_items],
  );
  const activityItems = useMemo(
    () => resolveActivityItems(panels.recent_activity, t),
    [panels.recent_activity, t],
  );
  const categories = useMemo(
    () => resolveCategorySlices(panels.tickets_by_category),
    [panels.tickets_by_category],
  );

  const hasSalesData =
    dashboard.kpis.tickets_sold.value > 0 ||
    dashboard.kpis.total_revenue.value > 0 ||
    dashboard.kpis.bar_consumption.value > 0 ||
    dashboard.recent_activity.length > 0;

  const eventsWithSales = useMemo(
    () =>
      events.filter(
        (event) => (event.ticket_order_count ?? 0) + (event.drink_order_count ?? 0) > 0,
      ),
    [events],
  );

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (loading || eventsLoading) {
    return <LoadingBlock label={t('dashboard.loading')} />;
  }

  return (
    <section className="event-dashboard">
      <DashboardHeader
        producerName={selectedEvent?.producer_name}
        salesPeriod={salesPeriod}
        onSalesPeriodChange={setSalesPeriod}
        activityItems={activityItems}
        eventId={selectedEvent?.id}
      />

      {selectedEvent && !hasSalesData ? (
        <div className="alert alert--info dash-empty-event">
          <strong>{t('dashboard.noSalesForEventTitle')}</strong>
          <p>{t('dashboard.noSalesForEventBody')}</p>
          {eventsWithSales.length > 0 ? (
            <p className="dash-empty-event__suggestions">
              {t('dashboard.tryEventWithSales')}{' '}
              {eventsWithSales.map((event, index) => (
                <span key={event.id}>
                  {index > 0 ? ', ' : null}
                  <button
                    type="button"
                    className="dash-empty-event__link"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    {event.title}
                  </button>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="dash-kpi-grid">
        <DashboardKpiCard
          label={t('dashboard.kpiTicketsSold')}
          value={formatCount(kpis.tickets_sold.value, numberLocale)}
          deltaLabel={dashboardKpiDeltaLabel(salesPeriod, kpis.tickets_sold.delta_pct, t)}
          deltaPositive={dashboardKpiDeltaPositive(kpis.tickets_sold.delta_pct)}
          deltaNeutral={kpis.tickets_sold.delta_pct === null}
          sparkline={resolveDashboardKpiSparkline(salesPeriod, kpis.tickets_sold.sparkline)}
          icon={<IconTicket />}
        />
        <DashboardKpiCard
          label={t('dashboard.kpiTotalRevenue')}
          value={formatDashboardCurrency(kpis.total_revenue.value, numberLocale, dashboard.currency)}
          deltaLabel={dashboardKpiDeltaLabel(salesPeriod, kpis.total_revenue.delta_pct, t)}
          deltaPositive={dashboardKpiDeltaPositive(kpis.total_revenue.delta_pct)}
          deltaNeutral={kpis.total_revenue.delta_pct === null}
          sparkline={resolveDashboardKpiSparkline(salesPeriod, kpis.total_revenue.sparkline)}
          icon={<IconTrending />}
        />
        <DashboardKpiCard
          label={t('dashboard.kpiBarConsumption')}
          value={formatCount(kpis.bar_consumption.value, numberLocale)}
          deltaLabel={dashboardKpiDeltaLabel(salesPeriod, kpis.bar_consumption.delta_pct, t)}
          deltaPositive={dashboardKpiDeltaPositive(kpis.bar_consumption.delta_pct)}
          deltaNeutral={kpis.bar_consumption.delta_pct === null}
          sparkline={resolveDashboardKpiSparkline(salesPeriod, kpis.bar_consumption.sparkline)}
          icon={<IconDrink />}
        />
        <DashboardKpiCard
          label={t('dashboard.kpiActiveUsers')}
          value={formatCount(kpis.active_users.value, numberLocale)}
          deltaLabel={dashboardKpiDeltaLabel(salesPeriod, kpis.active_users.delta_pct, t)}
          deltaPositive={dashboardKpiDeltaPositive(kpis.active_users.delta_pct)}
          deltaNeutral={kpis.active_users.delta_pct === null}
          sparkline={resolveDashboardKpiSparkline(salesPeriod, kpis.active_users.sparkline)}
          icon={<IconUsers />}
        />
      </div>

      <DashboardBody
        eventId={selectedEvent?.id}
        hourlySalesLast24h={hourlySalesLast24h}
        activityItems={activityItems}
        topProducts={topProducts}
        categories={categories}
      />

      {selectedEvent ? (
        <p className="dash-footer-note">
          {t('dashboard.eventContext')}{' '}
          <Link to={`/events/${selectedEvent.id}/orders`}>{selectedEvent.title}</Link>
        </p>
      ) : (
        <p className="dash-footer-note">{t('dashboard.noEventSelected')}</p>
      )}
    </section>
  );
}
