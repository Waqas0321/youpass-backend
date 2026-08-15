import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import {
  IconChart,
  IconClock,
  IconCreditCard,
  IconDownload,
  IconRefresh,
  IconSettings,
  IconTicket,
  IconTrending,
  IconUsers,
  IconX,
} from '../ui/Icons';

export type AnalyticsExportFormat = 'pdf' | 'excel';

export type AnalyticsExportReportId =
  | 'full'
  | 'sales'
  | 'tickets'
  | 'consumption'
  | 'zones'
  | 'payments'
  | 'products'
  | 'topTickets'
  | 'vip'
  | 'peakEntry'
  | 'peakConsumption'
  | 'recurring'
  | 'social';

type ReportOption = {
  id: AnalyticsExportReportId;
  tone: 'purple' | 'blue' | 'green' | 'orange' | 'yellow' | 'pink';
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
};

const EXPORT_REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'full',
    tone: 'purple',
    icon: <IconDownload />,
    titleKey: 'eventAnalytics.exportReportFullTitle',
    descriptionKey: 'eventAnalytics.exportReportFullDescription',
  },
  {
    id: 'sales',
    tone: 'purple',
    icon: <IconTrending />,
    titleKey: 'eventAnalytics.exportReportSalesTitle',
    descriptionKey: 'eventAnalytics.exportReportSalesDescription',
  },
  {
    id: 'tickets',
    tone: 'blue',
    icon: <IconChart />,
    titleKey: 'eventAnalytics.exportReportTicketsTitle',
    descriptionKey: 'eventAnalytics.exportReportTicketsDescription',
  },
  {
    id: 'consumption',
    tone: 'green',
    icon: <ExportDonutIcon />,
    titleKey: 'eventAnalytics.exportReportConsumptionTitle',
    descriptionKey: 'eventAnalytics.exportReportConsumptionDescription',
  },
  {
    id: 'zones',
    tone: 'purple',
    icon: <ExportBarsIcon />,
    titleKey: 'eventAnalytics.exportReportZonesTitle',
    descriptionKey: 'eventAnalytics.exportReportZonesDescription',
  },
  {
    id: 'payments',
    tone: 'orange',
    icon: <IconCreditCard />,
    titleKey: 'eventAnalytics.exportReportPaymentsTitle',
    descriptionKey: 'eventAnalytics.exportReportPaymentsDescription',
  },
  {
    id: 'products',
    tone: 'yellow',
    icon: <ExportStarIcon />,
    titleKey: 'eventAnalytics.exportReportProductsTitle',
    descriptionKey: 'eventAnalytics.exportReportProductsDescription',
  },
  {
    id: 'topTickets',
    tone: 'yellow',
    icon: <IconTicket />,
    titleKey: 'eventAnalytics.exportReportTopTicketsTitle',
    descriptionKey: 'eventAnalytics.exportReportTopTicketsDescription',
  },
  {
    id: 'vip',
    tone: 'blue',
    icon: <IconUsers />,
    titleKey: 'eventAnalytics.exportReportVipTitle',
    descriptionKey: 'eventAnalytics.exportReportVipDescription',
  },
  {
    id: 'peakEntry',
    tone: 'purple',
    icon: <IconClock />,
    titleKey: 'eventAnalytics.exportReportPeakEntryTitle',
    descriptionKey: 'eventAnalytics.exportReportPeakEntryDescription',
  },
  {
    id: 'peakConsumption',
    tone: 'blue',
    icon: <IconClock />,
    titleKey: 'eventAnalytics.exportReportPeakConsumptionTitle',
    descriptionKey: 'eventAnalytics.exportReportPeakConsumptionDescription',
  },
  {
    id: 'recurring',
    tone: 'green',
    icon: <IconRefresh />,
    titleKey: 'eventAnalytics.exportReportRecurringTitle',
    descriptionKey: 'eventAnalytics.exportReportRecurringDescription',
  },
  {
    id: 'social',
    tone: 'pink',
    icon: <IconSettings />,
    titleKey: 'eventAnalytics.exportReportSocialTitle',
    descriptionKey: 'eventAnalytics.exportReportSocialDescription',
  },
];

type Props = {
  open: boolean;
  format: AnalyticsExportFormat;
  onClose: () => void;
  onSelectReport: (reportId: AnalyticsExportReportId, format: AnalyticsExportFormat) => void;
};

function ExportDonutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ExportBarsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="12" width="3" height="8" rx="1" />
      <rect x="10.5" y="8" width="3" height="12" rx="1" />
      <rect x="17" y="5" width="3" height="15" rx="1" />
    </svg>
  );
}

function ExportStarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 4.5 14.2 9.8 20 10.6 15.8 14.6 16.9 20.4 12 17.7 7.1 20.4 8.2 14.6 4 10.6 9.8 9.8 12 4.5Z" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfoCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EventAnalyticsExportModal({ open, format, onClose, onSelectReport }: Props) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="event-analytics-export-modal__backdrop" onClick={onClose}>
      <div
        className="event-analytics-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-export-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="event-analytics-export-modal__header">
          <div className="event-analytics-export-modal__intro">
            <span className="event-analytics-export-modal__title-icon" aria-hidden="true">
              <IconDownload />
            </span>
            <div>
              <h2 id="analytics-export-modal-title">{t('eventAnalytics.exportModalTitle')}</h2>
              <p>{t('eventAnalytics.exportModalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className="event-analytics-export-modal__close"
            onClick={onClose}
            aria-label={t('eventAnalytics.exportModalClose')}
          >
            <IconX />
          </button>
        </header>

        <ul className="event-analytics-export-modal__list">
          {EXPORT_REPORT_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="event-analytics-export-modal__item"
                onClick={() => onSelectReport(option.id, format)}
              >
                <span
                  className={`event-analytics-export-modal__item-icon event-analytics-export-modal__item-icon--${option.tone}`}
                >
                  {option.icon}
                </span>
                <span className="event-analytics-export-modal__item-copy">
                  <strong>{t(option.titleKey)}</strong>
                  <span>{t(option.descriptionKey)}</span>
                </span>
                <IconChevronRight />
              </button>
            </li>
          ))}
        </ul>

        <footer className="event-analytics-export-modal__footer">
          <IconInfoCircle />
          <p>{t('eventAnalytics.exportModalFooter')}</p>
        </footer>
      </div>
    </div>
  );
}
