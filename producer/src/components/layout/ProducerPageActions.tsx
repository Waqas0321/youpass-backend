import { getSession } from '../../auth/session';
import { LanguageToggle } from '../../components/ui/LanguageToggle';
import { IconCalendar, IconChevronDown } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  dateRangeLabel: string;
};

export function ProducerPageActions({ dateRangeLabel }: Props) {
  const { t } = useI18n();
  const session = getSession();
  const displayName = session?.producerName ?? t('common.defaultAdminName');
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="producer-page-actions">
      <LanguageToggle />
      <button type="button" className="producer-page-actions__range">
        <IconCalendar className="producer-page-actions__icon" />
        <span>{dateRangeLabel}</span>
        <IconChevronDown className="producer-page-actions__icon" />
      </button>
      <button type="button" className="producer-page-actions__profile">
        <span className="producer-page-actions__avatar">{initials || 'YP'}</span>
        <span className="producer-page-actions__profile-text">
          <strong>{displayName}</strong>
          <span>{t('dashboard.adminRole')}</span>
        </span>
        <IconChevronDown className="producer-page-actions__icon" />
      </button>
    </div>
  );
}
