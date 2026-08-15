import { useState } from 'react';
import { EventPaymentsContent, EventPaymentsDownloadButton } from '../components/event-payments/EventPaymentsContent';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { useI18n } from '../i18n/useI18n';

export function EventPaymentsPage() {
  const { t } = useI18n();
  const [message, setMessage] = useState('');

  function handleDownloadReport() {
    setMessage(t('eventPayments.downloadSoon'));
  }

  return (
    <EventWorkspacePage
      pageTitle={t('eventPayments.title')}
      pageSubtitle={t('eventPayments.subtitle')}
      headerActions={<EventPaymentsDownloadButton onClick={handleDownloadReport} />}
      loadingLabel={t('eventPayments.loading')}
      notFoundLabel={t('eventPayments.notFound')}
    >
      {message ? <Alert tone="info">{message}</Alert> : null}
      <EventPaymentsContent />
    </EventWorkspacePage>
  );
}
