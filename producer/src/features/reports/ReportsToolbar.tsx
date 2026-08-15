import {
  IconCalendar,
  IconChevronDown,
  IconFilePdf,
  IconFileSpreadsheet,
  IconSearch,
} from '../../components/ui/Icons';
import { formatEventPickerDate } from '../calendar/formatCalendarDates';
import { getProducerEvent } from '../events/eventCatalog';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  eventId: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
};

export function ReportsToolbar({
  query,
  onQueryChange,
  eventId,
  onExportExcel,
  onExportPdf,
}: Props) {
  const { locale, t, dateLocale } = useI18n();
  const event = getProducerEvent(eventId);
  const eventDateLabel = event ? formatEventPickerDate(event.date, dateLocale) : '—';

  return (
    <div className="prod-reports-toolbar" key={locale}>
      <label className="prod-reports-toolbar__search">
        <span className="prod-reports-toolbar__field-label">{t('reports.searchLabel')}</span>
        <span className="prod-reports-toolbar__search-control">
          <IconSearch className="prod-reports-toolbar__icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('reports.searchPlaceholder')}
            aria-label={t('reports.searchAriaLabel')}
          />
        </span>
      </label>

      <div className="prod-reports-toolbar__date">
        <span className="prod-reports-toolbar__field-label">{t('reports.eventDate')}</span>
        <button type="button" className="prod-reports-toolbar__date-btn">
          <IconCalendar className="prod-reports-toolbar__icon" aria-hidden="true" />
          <span>{eventDateLabel}</span>
          <IconChevronDown className="prod-reports-toolbar__icon" aria-hidden="true" />
        </button>
      </div>

      <div className="prod-reports-toolbar__exports">
        <button type="button" className="prod-reports-toolbar__export-btn" onClick={onExportExcel}>
          <IconFileSpreadsheet className="prod-reports-toolbar__export-icon" aria-hidden="true" />
          <span>{t('reports.exportExcel')}</span>
        </button>
        <button type="button" className="prod-reports-toolbar__export-btn" onClick={onExportPdf}>
          <IconFilePdf className="prod-reports-toolbar__export-icon" aria-hidden="true" />
          <span>{t('reports.exportPdf')}</span>
        </button>
      </div>
    </div>
  );
}
