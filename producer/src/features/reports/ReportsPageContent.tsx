import { useMemo, useState } from 'react';
import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import { IconDrink, IconTicket } from '../../components/ui/Icons';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatCurrencyClp } from '../../i18n/helpers';
import { useI18n } from '../../i18n/useI18n';
import { formatDateRangeLabel } from '../calendar/formatCalendarDates';
import { ReportsSalesPanel } from './ReportsSalesPanel';
import { getReportEventSnapshot } from './reportsDemo';
import { ReportsDemographicsPanel } from './ReportsDemographicsPanel';
import { ReportsMetricCard } from './ReportsMetricCard';
import { ReportsToolbar } from './ReportsToolbar';
import { ReportsTopProductsPanel } from './ReportsTopProductsPanel';
import {
  DEFAULT_REPORT_EVENT_ID,
  getEventReportMetrics,
  REPORTS_PAGE_DATE_RANGE,
  resolveReportEventId,
} from './reportsDemo';

export function ReportsPageContent() {
  const { locale, t, dateLocale, numberLocale } = useI18n();
  const [query, setQuery] = useState('Caribe Night');

  const eventId = useMemo(() => resolveReportEventId(query), [query]);
  const event = getReportEventSnapshot(eventId) ?? getReportEventSnapshot(DEFAULT_REPORT_EVENT_ID);
  const metrics = useMemo(() => getEventReportMetrics(eventId), [eventId]);

  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(REPORTS_PAGE_DATE_RANGE.start, REPORTS_PAGE_DATE_RANGE.end, dateLocale),
    [dateLocale],
  );

  useDocumentTitle('reports');

  if (!event) {
    return null;
  }

  return (
    <section className="prod-reports-page" key={locale}>
      <header className="prod-reports-page__header">
        <div className="prod-reports-page__intro">
          <h1>{t('reports.title')}</h1>
          <p>{t('reports.subtitle')}</p>
        </div>
        <ProducerPageActions dateRangeLabel={dateRangeLabel} />
      </header>

      <ReportsToolbar
        query={query}
        onQueryChange={setQuery}
        eventId={event.id}
        onExportExcel={() => undefined}
        onExportPdf={() => undefined}
      />

      <div className="prod-reports-main">
        <article className="prod-reports-panel prod-reports-panel--sales">
          <ReportsSalesPanel event={event} />
        </article>
        <ReportsDemographicsPanel
          genderSlices={metrics.genderSlices}
          ageGroups={metrics.ageGroups}
        />
      </div>

      <div className="prod-reports-metrics">
        <ReportsMetricCard
          title={t('reports.avgTicketTitle')}
          value={formatCurrencyClp(metrics.avgTicketClp, numberLocale)}
          subtitle={t('reports.avgTicketSubtitle')}
          icon={<IconTicket />}
          tone="gold"
        />
        <ReportsTopProductsPanel products={metrics.topProducts} />
        <ReportsMetricCard
          title={t('reports.ticketRevenueTitle')}
          value={formatCurrencyClp(metrics.ticketRevenueClp, numberLocale)}
          subtitle={t('reports.ticketRevenueSubtitle')}
          icon={<IconTicket />}
          tone="purple"
        />
        <ReportsMetricCard
          title={t('reports.productRevenueTitle')}
          value={formatCurrencyClp(metrics.productRevenueClp, numberLocale)}
          subtitle={t('reports.productRevenueSubtitle')}
          icon={<IconDrink />}
          tone="pink"
        />
      </div>
    </section>
  );
}
