import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminEventPayments } from '../../api/client';
import { Alert } from '../ui/Alert';
import {
  IconCreditCard,
  IconDollar,
  IconDownload,
  IconRefresh,
  IconShoppingBag,
  IconTrending,
} from '../ui/Icons';
import { LoadingBlock } from '../ui/LoadingBlock';
import { useI18n } from '../../i18n/useI18n';
import { EventPaymentsBottomSection } from './EventPaymentsBottomSection';
import { EventPaymentsChartsGrid } from './EventPaymentsChartsGrid';
import { EventPaymentsKpiGrid } from './EventPaymentsKpiGrid';
import { EventPaymentsToolbar } from './EventPaymentsToolbar';
import {
  filterPaymentTransactions,
  type PaymentKpi,
  type PaymentMethodSummary,
  type PaymentSettlement,
  type PaymentTransaction,
} from './eventPaymentsDemo';

function mapPaymentsPayload(payload: AdminEventPayments) {
  const kpis: PaymentKpi[] = (payload.kpis ?? []).map((kpi) => ({
    id: kpi.id,
    tone: kpi.tone,
    value: kpi.value,
    deltaPct: kpi.delta_pct,
    deltaTone: kpi.delta_tone,
  }));

  const transactions: PaymentTransaction[] = (payload.transactions ?? []).map((txn) => ({
    id: txn.id,
    user: txn.user,
    product: txn.product,
    method: txn.method,
    methodTone: txn.method_tone,
    status: txn.status,
    amount: txn.amount,
    date: txn.date,
  }));

  const methodSummary: PaymentMethodSummary[] = (payload.method_summary ?? []).map((row) => ({
    method: row.method,
    methodTone: row.method_tone,
    count: row.count,
    sharePct: row.share_pct,
    amount: row.amount,
  }));

  const settlements: PaymentSettlement[] = (payload.settlements ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    status: row.status,
    amount: row.amount,
    accountMask: row.account_mask,
  }));

  return {
    kpis,
    transactions,
    methodSummary,
    settlements,
    dailySales: payload.daily_sales ?? [],
    refundSeries: payload.refunds_series ?? [],
    revenueByCategory: payload.revenue_by_category ?? [],
    paymentMethods: payload.payment_methods ?? [],
    paymentMethodsAvailable: payload.payment_methods_available,
    settlementsAvailable: payload.settlements_available,
  };
}

export function EventPaymentsContent({
  onDataChange,
}: {
  onDataChange?: (data: {
    kpis: PaymentKpi[];
    transactions: PaymentTransaction[];
    methodSummary: PaymentMethodSummary[];
  }) => void;
}) {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<ReturnType<typeof mapPaymentsPayload> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!eventId) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await adminApi.eventPayments(eventId);
        if (cancelled) {
          return;
        }
        if (!result.ok || !result.data) {
          setPayload(null);
          setError(result.ok ? t('eventPayments.loadError') : result.error);
          onDataChange?.({ kpis: [], transactions: [], methodSummary: [] });
          return;
        }
        const mapped = mapPaymentsPayload(result.data);
        setPayload(mapped);
        onDataChange?.({
          kpis: mapped.kpis,
          transactions: mapped.transactions,
          methodSummary: mapped.methodSummary,
        });
      } catch (err) {
        if (cancelled) {
          return;
        }
        setPayload(null);
        setError(err instanceof Error ? err.message : t('eventPayments.loadError'));
        onDataChange?.({ kpis: [], transactions: [], methodSummary: [] });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, onDataChange, t]);

  const transactions = useMemo(
    () => filterPaymentTransactions(payload?.transactions ?? [], debouncedSearch),
    [debouncedSearch, payload?.transactions],
  );

  const kpiIcons = {
    gross: <IconDollar />,
    commission: <IconTrending />,
    net: <IconShoppingBag />,
    refunds: <IconRefresh />,
    pendingSettlement: <IconCreditCard />,
  } as const;

  function showComingSoon() {
    setMessage(t('eventPayments.comingSoon'));
  }

  if (loading) {
    return <LoadingBlock label={t('eventPayments.loading')} />;
  }

  if (error || !payload) {
    return <Alert tone="error">{error || t('eventPayments.loadError')}</Alert>;
  }

  return (
    <div className="event-payments-page">
      {message ? <Alert tone="info">{message}</Alert> : null}

      <EventPaymentsToolbar
        search={search}
        onSearchChange={setSearch}
        onClearSearch={() => setSearch('')}
        onOpenFilters={showComingSoon}
      />

      <EventPaymentsKpiGrid kpis={payload.kpis} icons={kpiIcons} />

      <EventPaymentsChartsGrid
        dailySales={payload.dailySales}
        refundSeries={payload.refundSeries}
        revenueByCategory={payload.revenueByCategory}
        paymentMethods={payload.paymentMethods}
      />

      <EventPaymentsBottomSection
        transactions={transactions}
        hasActiveSearch={Boolean(debouncedSearch)}
        methodSummary={payload.methodSummary}
        settlements={payload.settlements}
      />
    </div>
  );
}

export function EventPaymentsDownloadButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();

  return (
    <button type="button" className="event-workspace__btn event-workspace__btn--ghost" onClick={onClick}>
      <IconDownload />
      {t('eventPayments.downloadReport')}
    </button>
  );
}
