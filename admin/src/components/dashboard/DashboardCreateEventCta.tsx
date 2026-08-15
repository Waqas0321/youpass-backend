import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { IconCalendar, IconChevronRight } from '../ui/Icons';

export function DashboardCreateEventCta() {
  const { t } = useI18n();

  return (
    <article className="dash-panel dash-panel--cta">
      <div className="dash-cta__layout">
        <span className="dash-cta__badge" aria-hidden="true">
          <IconCalendar className="dash-cta__badge-icon" />
        </span>
        <div className="dash-cta__copy">
          <h3>{t('dashboard.createEventTitle')}</h3>
          <p>{t('dashboard.createEventBody')}</p>
          <Link to="/events/new/info" className="dash-cta__button">
            {t('dashboard.createEventCta')}
            <IconChevronRight className="dash-cta__icon" />
          </Link>
        </div>
      </div>
    </article>
  );
}
