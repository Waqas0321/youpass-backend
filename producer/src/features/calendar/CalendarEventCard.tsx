import { IconGrip, IconMapPin } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { CalendarEvent } from './calendarDemo';

type Props = {
  event: CalendarEvent;
  onViewMore: (event: CalendarEvent) => void;
};

export function CalendarEventCard({ event, onViewMore }: Props) {
  const { t } = useI18n();

  return (
    <article className="prod-cal-event">
      <div className="prod-cal-event__main">
        <span className="prod-cal-event__drag" aria-hidden="true">
          <IconGrip className="prod-cal-event__drag-icon" />
        </span>
        <div className="prod-cal-event__content">
          <strong className="prod-cal-event__title">{event.title}</strong>
          <p className="prod-cal-event__venue">
            <IconMapPin className="prod-cal-event__venue-icon" />
            <span>{event.venue}</span>
          </p>
          <button type="button" className="prod-cal-event__more" onClick={() => onViewMore(event)}>
            {t('calendar.viewMore')}
          </button>
        </div>
      </div>
    </article>
  );
}
