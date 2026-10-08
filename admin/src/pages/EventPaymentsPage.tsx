import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  EventPaymentsContent,
  EventPaymentsDownloadButton,
} from '../components/event-payments/EventPaymentsContent';
import {
  downloadPaymentsReport,
  type PaymentKpi,
  type PaymentMethodSummary,
  type PaymentTransaction,
} from '../components/event-payments/eventPaymentsDemo';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { useI18n } from '../i18n/useI18n';

export function EventPaymentsPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const reportRef = useRef<{
    kpis: PaymentKpi[];
    transactions: PaymentTransaction[];
    methodSummary: PaymentMethodSummary[];
  }>({ kpis: [], transactions: [], methodSummary: [] });

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleDataChange = useCallback(
    (data: {
      kpis: PaymentKpi[];
      transactions: PaymentTransaction[];
      methodSummary: PaymentMethodSummary[];
    }) => {
      reportRef.current = data;
    },
    [],
  );

  function handleDownloadReport() {
    downloadPaymentsReport({
      eventId: eventId || 'event',
      transactions: reportRef.current.transactions,
      kpis: reportRef.current.kpis,
      methodSummary: reportRef.current.methodSummary,
    });
    setMessage(t('eventPayments.downloadSuccess'));
  }

  return (
    <EventWorkspacePage
      pageTitle={t('eventPayments.title')}
      pageSubtitle={t('eventPayments.subtitle')}
      headerActions={<EventPaymentsDownloadButton onClick={handleDownloadReport} />}
      loadingLabel={t('eventPayments.loading')}
      notFoundLabel={t('eventPayments.notFound')}
    >
      {message ? <Alert tone="success">{message}</Alert> : null}
      <EventPaymentsContent onDataChange={handleDataChange} />
    </EventWorkspacePage>
  );
}
