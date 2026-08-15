import type { CalendarDay } from './calendarUtils';
import { CalendarEventCard } from './CalendarEventCard';
import type { CalendarEvent } from './calendarDemo';

type Props = {
  day: CalendarDay;
  events: CalendarEvent[];
  onViewEvent: (event: CalendarEvent) => void;
};

export function CalendarDayCell({ day, events, onViewEvent }: Props) {
  const dayNumber = day.date.getDate();
  const hasEvents = events.length > 0;

  return (
    <div
      className={[
        'prod-cal-day',
        !day.inCurrentMonth ? 'prod-cal-day--muted' : '',
        day.isToday ? 'prod-cal-day--today' : '',
        hasEvents ? 'prod-cal-day--has-events' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="prod-cal-day__header">
        {hasEvents ? <span className="prod-cal-day__dot" aria-hidden="true" /> : null}
        <span className="prod-cal-day__number">{dayNumber}</span>
      </div>
      <div className="prod-cal-day__events">
        {events.map((event) => (
          <CalendarEventCard key={event.id} event={event} onViewMore={onViewEvent} />
        ))}
      </div>
    </div>
  );
}
