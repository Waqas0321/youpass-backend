import { useSelectedEvent } from '../context/SelectedEventContext';
import { EventAnalyticsContent } from '../components/event-analytics/EventAnalyticsContent';
import { Alert } from '../components/ui/Alert';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

export function AnalyticsPage() {
  const { t } = useI18n();
  const { selectedEvent, eventsLoading } = useSelectedEvent();

  if (eventsLoading) {
    return <LoadingBlock label={t('eventAnalytics.loading')} />;
  }

  if (!selectedEvent) {
    return <Alert tone="info">{t('dashboard.noEventSelected')}</Alert>;
  }

  return <EventAnalyticsContent eventId={selectedEvent.id} event={selectedEvent} />;
}
