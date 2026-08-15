import type { CalendarEventListItem } from '../events/types';
import { producerCalendarEvents } from '../events/eventCatalog';

export type CalendarEvent = CalendarEventListItem;

export type CalendarPageData = {
  dateRangeStart: string;
  dateRangeEnd: string;
  initialYear: number;
  initialMonth: number;
  events: CalendarEvent[];
};

export const producerCalendarDemo: CalendarPageData = {
  dateRangeStart: '2026-01-25',
  dateRangeEnd: '2026-01-31',
  initialYear: 2026,
  initialMonth: 0,
  events: producerCalendarEvents,
};

export function eventsByDate(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((map, event) => {
    const bucket = map[event.date] ?? [];
    bucket.push(event);
    map[event.date] = bucket;
    return map;
  }, {});
}
