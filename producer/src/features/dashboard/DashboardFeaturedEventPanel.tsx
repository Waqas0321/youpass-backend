import { useMemo, useState } from 'react';
import { useEventDetailModal } from '../../features/events/EventDetailModalProvider';
import {
  IconCalendar,
  IconChevronDown,
  IconMapPin,
  IconTicket,
  IconUsers,
} from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { eventCategoryLabel } from '../../i18n/localize';
import { formatEventLongDate } from '../calendar/formatCalendarDates';
import { formatCount } from './dashboardChartUtils';
import type { FeaturedEvent } from './dashboardDemo';

type Props = {
  events: FeaturedEvent[];
};

export function DashboardFeaturedEventPanel({ events }: Props) {
  const { openEventDetail } = useEventDetailModal();
  const { t, dateLocale, numberLocale } = useI18n();
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');
  const event = useMemo(
    () => events.find((item) => item.id === selectedId) ?? events[0],
    [events, selectedId],
  );

  if (!event) {
    return null;
  }

  return (
    <article className="prod-dash-panel prod-dash-panel--featured">
      <header className="prod-dash-panel__header">
        <h2>{t('dashboard.featuredEventTitle')}</h2>
        <label className="prod-dash-event-select">
          <span className="prod-dash-event-select__label">{t('dashboard.selectEvent')}</span>
          <span className="prod-dash-event-select__control">
            <select value={event.id} onChange={(e) => setSelectedId(e.target.value)}>
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <IconChevronDown className="prod-dash-event-select__chevron" />
          </span>
        </label>
      </header>

      <div className="prod-dash-featured">
        <div className="prod-dash-featured__poster">
          <img src={event.imageUrl} alt={event.title} loading="lazy" />
        </div>
        <div className="prod-dash-featured__body">
          <div className="prod-dash-featured__title-row">
            <h3>{event.title}</h3>
            <span className={`prod-dash-tag prod-dash-tag--${event.categoryTone}`}>
              {eventCategoryLabel(t, event.categoryTone)}
            </span>
          </div>
          <dl className="prod-dash-featured__meta">
            <div>
              <dt><IconMapPin /></dt>
              <dd>
                <span>{t('dashboard.venue')}</span>
                <strong>{event.venue}</strong>
              </dd>
            </div>
            <div>
              <dt><IconCalendar /></dt>
              <dd>
                <span>{t('dashboard.date')}</span>
                <strong>{formatEventLongDate(event.date, dateLocale)}</strong>
              </dd>
            </div>
            <div>
              <dt><IconTicket /></dt>
              <dd>
                <span>{t('dashboard.category')}</span>
                <strong>{eventCategoryLabel(t, event.categoryTone)}</strong>
              </dd>
            </div>
            <div>
              <dt><IconUsers /></dt>
              <dd>
                <span>{t('dashboard.producer')}</span>
                <strong>{event.producer}</strong>
              </dd>
            </div>
            <div>
              <dt><IconUsers /></dt>
              <dd>
                <span>{t('dashboard.capacity')}</span>
                <strong>
                  {formatCount(event.capacity, numberLocale)} {t('dashboard.people')}
                </strong>
              </dd>
            </div>
            <div>
              <dt><IconTicket /></dt>
              <dd>
                <span>{t('dashboard.status')}</span>
                <strong className="prod-dash-featured__status">{t('dashboard.statusActive')}</strong>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <footer className="prod-dash-panel__footer prod-dash-panel__footer--end">
        <button
          type="button"
          className="prod-dash-panel__link prod-dash-panel__link--button"
          onClick={() => openEventDetail(event.id)}
        >
          {t('dashboard.viewFullDetail')} →
        </button>
      </footer>
    </article>
  );
}
