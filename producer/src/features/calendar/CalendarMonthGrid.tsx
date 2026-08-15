import { useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { CalendarDayCell } from './CalendarDayCell';
import type { CalendarEvent } from './calendarDemo';
import { eventsByDate } from './calendarDemo';
import { buildMonthWeeks, weekdayLabels } from './calendarUtils';

type Props = {
  year: number;
  month: number;
  events: CalendarEvent[];
  onViewEvent: (event: CalendarEvent) => void;
};

export function CalendarMonthGrid({ year, month, events, onViewEvent }: Props) {
  const { dateLocale } = useI18n();
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const eventMap = useMemo(() => eventsByDate(events), [events]);
  const weekdays = useMemo(() => weekdayLabels(dateLocale), [dateLocale]);

  return (
    <div className="prod-cal-grid">
      <div className="prod-cal-grid__weekdays">
        {weekdays.map((label) => (
          <span key={label} className="prod-cal-grid__weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="prod-cal-grid__weeks">
        {weeks.map((week) => (
          <div key={week[0]?.iso} className="prod-cal-grid__week">
            {week.map((day) => (
              <CalendarDayCell
                key={day.iso}
                day={day}
                events={eventMap[day.iso] ?? []}
                onViewEvent={onViewEvent}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
