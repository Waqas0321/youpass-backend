import { useI18n } from '../../i18n/useI18n';
import { IconDownload, IconX } from '../ui/Icons';

export type OrdersExportType = 'all' | 'bar' | 'tickets' | 'vip';

type ExportOption = {
  id: OrdersExportType;
  titleKey: string;
  descriptionKey: string;
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'all',
    titleKey: 'orders.exportModal.allTitle',
    descriptionKey: 'orders.exportModal.allDescription',
  },
  {
    id: 'bar',
    titleKey: 'orders.exportModal.barTitle',
    descriptionKey: 'orders.exportModal.barDescription',
  },
  {
    id: 'tickets',
    titleKey: 'orders.exportModal.ticketsTitle',
    descriptionKey: 'orders.exportModal.ticketsDescription',
  },
  {
    id: 'vip',
    titleKey: 'orders.exportModal.vipTitle',
    descriptionKey: 'orders.exportModal.vipDescription',
  },
];

type Props = {
  open: boolean;
  exporting: boolean;
  onClose: () => void;
  onSelect: (type: OrdersExportType) => void;
};

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

function ExcelFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" opacity="0.18" />
      <path
        d="M8 8.5 10.2 12 8 15.5M12.5 15.5h3.5M12.5 8.5H16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EventOrdersExportModal({ open, exporting, onClose, onSelect }: Props) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="event-analytics-export-modal__backdrop" onClick={onClose}>
      <div
        className="event-analytics-export-modal event-orders-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orders-export-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="event-analytics-export-modal__header">
          <div className="event-analytics-export-modal__intro">
            <span className="event-analytics-export-modal__title-icon" aria-hidden="true">
              <IconDownload />
            </span>
            <div>
              <h2 id="orders-export-modal-title">{t('orders.exportModal.title')}</h2>
              <p>{t('orders.exportModal.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className="event-analytics-export-modal__close"
            onClick={onClose}
            aria-label={t('common.cancel')}
          >
            <IconX />
          </button>
        </header>

        <ul className="event-analytics-export-modal__list">
          {EXPORT_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="event-analytics-export-modal__item"
                disabled={exporting}
                onClick={() => onSelect(option.id)}
              >
                <span className="event-analytics-export-modal__item-icon event-analytics-export-modal__item-icon--green">
                  <ExcelFileIcon />
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

        <footer className="event-orders-export-modal__footer">
          <div className="event-analytics-export-modal__footer">
            <IconInfoCircle />
            <p>{t('orders.exportModal.footer')}</p>
          </div>
          <button type="button" className="event-orders-export-modal__cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </footer>
      </div>
    </div>
  );
}
