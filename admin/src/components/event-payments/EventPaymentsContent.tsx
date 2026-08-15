import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../ui/Alert';
import {
  IconCreditCard,
  IconDollar,
  IconDownload,
  IconRefresh,
  IconShoppingBag,
  IconTrending,
} from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { EventPaymentsBottomSection } from './EventPaymentsBottomSection';
import { EventPaymentsChartsGrid } from './EventPaymentsChartsGrid';
import { EventPaymentsKpiGrid } from './EventPaymentsKpiGrid';
import { EventPaymentsToolbar } from './EventPaymentsToolbar';
import { filterPaymentTransactions, PAYMENT_KPIS, PAYMENT_TRANSACTIONS } from './eventPaymentsDemo';

export function EventPaymentsContent() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const transactions = useMemo(
    () => filterPaymentTransactions(PAYMENT_TRANSACTIONS, debouncedSearch),
    [debouncedSearch],
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

  return (
    <div className="event-payments-page">
      {message ? <Alert tone="info">{message}</Alert> : null}

      <EventPaymentsToolbar
        search={search}
        onSearchChange={setSearch}
        onOpenFilters={showComingSoon}
      />

      <EventPaymentsKpiGrid kpis={PAYMENT_KPIS} icons={kpiIcons} />

      <EventPaymentsChartsGrid />

      <EventPaymentsBottomSection transactions={transactions} />
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
