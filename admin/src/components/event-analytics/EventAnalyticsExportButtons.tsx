import { useI18n } from '../../i18n/useI18n';

type Props = {
  onExportPdf: () => void;
  onExportExcel: () => void;
};

function ExportFileIcon({ kind }: { kind: 'pdf' | 'excel' }) {
  return (
    <span
      className={`event-analytics__export-icon event-analytics__export-icon--${kind}`}
      aria-hidden="true"
    >
      {kind === 'pdf' ? 'PDF' : 'XLS'}
    </span>
  );
}

export function EventAnalyticsExportButtons({ onExportPdf, onExportExcel }: Props) {
  const { t } = useI18n();

  return (
    <div className="event-workspace__header-action-group event-analytics__header-exports">
      <button type="button" className="event-analytics__export-btn" onClick={onExportPdf}>
        <ExportFileIcon kind="pdf" />
        {t('eventAnalytics.exportPdf')}
      </button>
      <button type="button" className="event-analytics__export-btn" onClick={onExportExcel}>
        <ExportFileIcon kind="excel" />
        {t('eventAnalytics.exportExcel')}
      </button>
    </div>
  );
}
