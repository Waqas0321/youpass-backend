import type { AdminEvent } from '../../api/client';

export type EventLifecycleFilter = 'all' | 'active' | 'upcoming' | 'finished' | 'drafts';

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function eventDisplayBadge(
  event: AdminEvent,
  now = new Date(),
): 'active' | 'upcoming' | 'draft' | null {
  if (event.status === 'draft') {
    return 'draft';
  }

  if (matchesLifecycleFilter(event, 'active', now)) {
    return 'active';
  }

  if (new Date(event.starts_at).getTime() > now.getTime()) {
    return 'upcoming';
  }

  return null;
}

const EVENT_FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Published events that have not finished can pause/resume ticket sales. */
export function canToggleEventSales(event: AdminEvent, now = new Date()): boolean {
  if (event.status !== 'published') {
    return false;
  }

  const startsAtMs = new Date(event.starts_at).getTime();
  const nowMs = now.getTime();
  return startsAtMs + EVENT_FINISHED_WINDOW_MS > nowMs;
}

export function isWithinUpcomingWindow(startsAt: string, now = new Date()) {
  const startsAtMs = new Date(startsAt).getTime();
  const nowMs = now.getTime();
  const diff = startsAtMs - nowMs;
  return diff > 0 && diff <= UPCOMING_WINDOW_MS;
}

export function matchesLifecycleFilter(event: AdminEvent, filter: EventLifecycleFilter, now = new Date()) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'drafts') {
    return event.status === 'draft';
  }

  if (event.status === 'draft') {
    return false;
  }

  const startsAtMs = new Date(event.starts_at).getTime();
  const nowMs = now.getTime();

  if (filter === 'upcoming') {
    return isWithinUpcomingWindow(event.starts_at, now);
  }

  if (filter === 'active') {
    return startsAtMs <= nowMs && nowMs - startsAtMs < ACTIVE_WINDOW_MS;
  }

  if (filter === 'finished') {
    return startsAtMs < nowMs && (nowMs - startsAtMs >= ACTIVE_WINDOW_MS || event.status === 'cancelled');
  }

  return false;
}

export function countEventsByLifecycle(events: AdminEvent[]) {
  const counts = {
    all: events.length,
    active: 0,
    upcoming: 0,
    finished: 0,
    drafts: 0,
  };

  for (const event of events) {
    if (event.status === 'draft') {
      counts.drafts += 1;
      continue;
    }

    if (matchesLifecycleFilter(event, 'active')) {
      counts.active += 1;
    }
    if (matchesLifecycleFilter(event, 'upcoming')) {
      counts.upcoming += 1;
    }
    if (matchesLifecycleFilter(event, 'finished')) {
      counts.finished += 1;
    }
  }

  return counts;
}

export function filterEventsByLifecycle(events: AdminEvent[], filter: EventLifecycleFilter) {
  if (filter === 'all') {
    return events;
  }

  return events.filter((event) => matchesLifecycleFilter(event, filter));
}

export function filterEventsBySearch(events: AdminEvent[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return events;
  }

  return events.filter((event) => {
    const haystack = [
      event.title,
      event.description,
      event.city,
      event.venue_name,
      event.location_display,
      event.producer_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function formatEventCapacityPct(ticketsSold: number, capacityTotal: number | null | undefined) {
  if (!capacityTotal || capacityTotal <= 0) {
    return null;
  }

  return Math.min(100, Math.round((ticketsSold / capacityTotal) * 100));
}

export function truncateDescription(text: string | null | undefined, maxLength = 120) {
  if (!text?.trim()) {
    return '';
  }

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trim()}…`;
}
