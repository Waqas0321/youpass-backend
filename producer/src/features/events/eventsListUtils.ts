import type { ProducerEvent } from './types';
import { formatEventLongDate } from '../calendar/formatCalendarDates';

export const EVENTS_LIST_DATE_RANGE = {
  start: '2026-01-04',
  end: '2026-02-28',
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterProducerEvents(
  events: ProducerEvent[],
  query: string,
  dateLocale: string,
) {
  const term = normalize(query);
  if (!term) {
    return events;
  }

  return events.filter((event) => {
    const haystack = [
      event.title,
      event.displayTitle,
      event.producer,
      event.venue,
      formatEventLongDate(event.date, dateLocale),
    ]
      .map(normalize)
      .join(' ');

    return haystack.includes(term);
  });
}

export function sortProducerEventsByDate(events: ProducerEvent[]) {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}

export function eventBannerUrl(posterUrl: string) {
  if (posterUrl.includes('unsplash.com')) {
    return posterUrl.replace(/w=\d+/, 'w=640');
  }
  return posterUrl;
}
