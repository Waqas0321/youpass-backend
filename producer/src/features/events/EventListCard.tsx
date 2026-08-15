import type { ProducerEvent } from './types';
import {
  IconBriefcase,
  IconCalendar,
  IconMapPin,
} from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { formatEventLongDate } from '../calendar/formatCalendarDates';
import { eventBannerUrl } from './eventsListUtils';

type Props = {
  event: ProducerEvent;
  onViewInfo: (eventId: string) => void;
};

export function EventListCard({ event, onViewInfo }: Props) {
  const { t, dateLocale } = useI18n();

  return (
    <article className="prod-events-card">
      <div className="prod-events-card__banner">
        <img src={eventBannerUrl(event.posterUrl)} alt="" loading="lazy" />
      </div>
      <div className="prod-events-card__body">
        <h2 className="prod-events-card__title">{event.title}</h2>
        <ul className="prod-events-card__meta">
          <li>
            <IconMapPin className="prod-events-card__icon" />
            <span>{event.venue}</span>
          </li>
          <li>
            <IconBriefcase className="prod-events-card__icon" />
            <span>{event.producer}</span>
          </li>
          <li>
            <IconCalendar className="prod-events-card__icon" />
            <span>{formatEventLongDate(event.date, dateLocale)}</span>
          </li>
        </ul>
        <div className="prod-events-card__footer">
          <button
            type="button"
            className="prod-events-card__cta"
            onClick={() => onViewInfo(event.id)}
          >
            {t('events.viewInfo')}
          </button>
        </div>
      </div>
    </article>
  );
}
