import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  EventPaymentsContent,
  EventPaymentsDownloadButton,
} from '../components/event-payments/EventPaymentsContent';
import { downloadPaymentsReport } from '../components/event-payments/eventPaymentsDemo';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { useI18n } from '../i18n/useI18n';

export function EventPaymentsPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function handleDownloadReport() {
    downloadPaymentsReport({ eventId: eventId || 'event' });
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
      <EventPaymentsContent />
    </EventWorkspacePage>
  );
}
