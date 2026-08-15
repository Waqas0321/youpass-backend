import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import type { DashboardActivityItem } from './dashboardData';
import { formatMinutesAgo } from './dashboardData';
import { DashboardActivityIcon } from './DashboardActivityIcon';

type DashboardActivityFeedProps = {
  eventId?: string;
  items: DashboardActivityItem[];
};

export function DashboardActivityFeed({ eventId, items }: DashboardActivityFeedProps) {
  const { t, dateLocale } = useI18n();
  const viewAllHref = eventId ? `/events/${eventId}/orders` : '/drink-menus';

  return (
    <article className="dash-panel dash-panel--activity">
      <header className="dash-panel__header">
        <h3>{t('dashboard.realtimeActivity')}</h3>
        <Link to={viewAllHref} className="dash-panel__action">
          {t('dashboard.viewAll')}
        </Link>
      </header>
      <ul className="dash-activity">
        {items.length === 0 ? (
          <li className="dash-activity__empty">{t('dashboard.noRecentActivity')}</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="dash-activity__item">
              <span className="dash-activity__icon">
                <DashboardActivityIcon type={item.icon} />
              </span>
              <div className="dash-activity__body">
                <p>{item.title}</p>
                {item.subtitle ? <span className="dash-activity__subtitle">{item.subtitle}</span> : null}
              </div>
              <span className="dash-activity__time">
                {formatMinutesAgo(item.minutesAgo, dateLocale)}
              </span>
              <span className="dash-activity__dot" aria-hidden="true" />
            </li>
          ))
        )}
      </ul>
    </article>
  );
}
