import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { eventCategoryLabel } from '../../i18n/localize';
import { formatEventCompactDate } from '../calendar/formatCalendarDates';
import type { CalendarEventItem } from './dashboardDemo';

type Props = {
  events: CalendarEventItem[];
};

export function DashboardEventCalendarPanel({ events }: Props) {
  const { t, dateLocale } = useI18n();

  return (
    <article className="prod-dash-panel prod-dash-panel--calendar">
      <header className="prod-dash-panel__header">
        <h2>{t('dashboard.eventCalendar')}</h2>
        <Link to="/calendar" className="prod-dash-panel__link">
          {t('dashboard.viewFullCalendar')} →
        </Link>
      </header>
      <ul className="prod-dash-calendar">
        {events.map((event) => (
          <li key={event.id} className="prod-dash-calendar__item">
            <div className="prod-dash-calendar__date">
              {formatEventCompactDate(event.date, dateLocale)}
            </div>
            <div className="prod-dash-calendar__thumb">
              <img src={event.imageUrl} alt="" loading="lazy" />
            </div>
            <div className="prod-dash-calendar__body">
              <strong className="prod-dash-calendar__title">{event.title}</strong>
              <p className="prod-dash-calendar__producer">{event.producer}</p>
              <p className="prod-dash-calendar__meta">
                {event.venue} · {event.time} {t('dashboard.hoursSuffix')}
              </p>
            </div>
            <span className={`prod-dash-tag prod-dash-tag--${event.categoryTone}`}>
              {eventCategoryLabel(t, event.categoryTone)}
            </span>
          </li>
        ))}
      </ul>
      <footer className="prod-dash-panel__footer">
        <Link to="/events" className="prod-dash-panel__link">
          {t('dashboard.viewAllEvents')} →
        </Link>
      </footer>
    </article>
  );
}
