import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DashboardSalesPeriod } from '../api/client';
import { EventAnalyticsContent } from '../components/event-analytics/EventAnalyticsContent';
import { EventAnalyticsExportButtons } from '../components/event-analytics/EventAnalyticsExportButtons';
import {
  EventAnalyticsExportModal,
  type AnalyticsExportFormat,
  type AnalyticsExportReportId,
} from '../components/event-analytics/EventAnalyticsExportModal';
import { downloadAnalyticsReport } from '../components/event-analytics/exportAnalyticsReport';
import type { EventAnalyticsView } from '../components/event-analytics/buildEventAnalyticsView';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { useI18n } from '../i18n/useI18n';

export function EventAnalyticsPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const analyticsRef = useRef<EventAnalyticsView | null>(null);
  const periodRef = useRef<DashboardSalesPeriod>('today');
  const [message, setMessage] = useState('');
  const [exportModal, setExportModal] = useState<{
    open: boolean;
    format: AnalyticsExportFormat;
  }>({
    open: false,
    format: 'excel',
  });

  const handleAnalyticsChange = useCallback(
    (view: EventAnalyticsView | null, period: DashboardSalesPeriod) => {
      analyticsRef.current = view;
      periodRef.current = period;
    },
    [],
  );

  function openExportModal(format: AnalyticsExportFormat) {
    setExportModal({ open: true, format });
  }

  function closeExportModal() {
    setExportModal((current) => ({ ...current, open: false }));
  }

  function handleExportReport(reportId: AnalyticsExportReportId, format: AnalyticsExportFormat) {
    const view = analyticsRef.current;
    if (!view) {
      setMessage(t('eventAnalytics.exportUnavailable'));
      closeExportModal();
      return;
    }

    downloadAnalyticsReport(view, reportId, format, periodRef.current);
    closeExportModal();
    setMessage(t('eventAnalytics.exportSuccess'));
  }

  const headerActions = (
    <EventAnalyticsExportButtons
      onExportPdf={() => openExportModal('pdf')}
      onExportExcel={() => openExportModal('excel')}
    />
  );

  return (
    <>
      <EventWorkspacePage
        pageTitle={t('eventAnalytics.title')}
        pageSubtitle={t('eventAnalytics.subtitle')}
        headerActions={headerActions}
        loadingLabel={t('eventAnalytics.loading')}
        notFoundLabel={t('eventAnalytics.noEventData')}
      >
        {message ? <Alert tone="info">{message}</Alert> : null}
        <EventAnalyticsContent eventId={eventId} onAnalyticsChange={handleAnalyticsChange} />
      </EventWorkspacePage>

      <EventAnalyticsExportModal
        open={exportModal.open}
        format={exportModal.format}
        onClose={closeExportModal}
        onSelectReport={handleExportReport}
      />
    </>
  );
}
