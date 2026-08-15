import { useSelectedEvent } from '../../context/SelectedEventContext';
import { useI18n } from '../../i18n/useI18n';
import { IconBell, IconChevronDown } from '../ui/Icons';
import { LanguageToggle } from '../ui/LanguageToggle';

type Props = {
  onAddStaff: () => void;
};

function producerInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'PP'
  );
}

export function StaffQrHeader({ onAddStaff }: Props) {
  const { t } = useI18n();
  const { selectedEvent } = useSelectedEvent();
  const producerName = selectedEvent?.producer_name?.trim() || t('dashboard.defaultProducer');
  const initials = producerInitials(producerName);

  return (
    <header className="dash-header staff-qr-header">
      <div className="dash-header__intro">
        <h1 className="dash-header__title">{t('staffQr.title')}</h1>
        <p className="dash-header__subtitle">{t('staffQr.subtitle')}</p>
      </div>

      <div className="dash-header__aside staff-qr-header__aside">
        <div className="dash-header__toolbar">
          <div className="dash-header__locale">
            <LanguageToggle />
          </div>
          <button
            type="button"
            className="dash-header__notify"
            aria-label={t('eventWorkspace.notifications')}
          >
            <IconBell />
            <span className="dash-header__notify-dot" aria-hidden="true" />
          </button>
          <button type="button" className="dash-header__profile">
            <span className="dash-header__profile-text">
              <strong>{producerName}</strong>
              <span>{t('common.administrator')}</span>
            </span>
            <span className="dash-header__avatar">{initials}</span>
            <IconChevronDown className="dash-header__chevron" />
          </button>
        </div>

        <button type="button" className="primary-btn staff-qr-add-btn staff-qr-header__add" onClick={onAddStaff}>
          {t('staffQr.addStaff')}
        </button>
      </div>
    </header>
  );
}
