import {
  PARTY_MODE_POST_EVENT_HOURS,
  PARTY_MODE_PRE_EVENT_HOURS,
} from './party-mode.constants.js';

export type PartyModeEventTiming = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
};

export function partyModeEventEnd(event: {
  startsAt: Date;
  endsAt: Date | null;
}): Date {
  return (
    event.endsAt ?? new Date(event.startsAt.getTime() + 24 * 60 * 60 * 1000)
  );
}

export function isEventLiveForPartyMode(
  event: { startsAt: Date; endsAt: Date | null },
  now: Date,
): boolean {
  const windowStart = new Date(
    event.startsAt.getTime() - PARTY_MODE_PRE_EVENT_HOURS * 60 * 60 * 1000,
  );
  const windowEnd = new Date(
    partyModeEventEnd(event).getTime() +
      PARTY_MODE_POST_EVENT_HOURS * 60 * 60 * 1000,
  );

  return now >= windowStart && now <= windowEnd;
}

/**
 * When multiple active tickets qualify, pick the drink-menu event by schedule:
 * 1. Currently in progress — latest start wins
 * 2. Upcoming (pre-window) — soonest start wins
 * 3. Recently ended (post-window) — latest end wins
 * 4. Fallback — start closest to now
 */
export function selectEventByDateTime<T extends PartyModeEventTiming>(
  events: T[],
  now: Date,
): T | null {
  if (events.length === 0) {
    return null;
  }
  if (events.length === 1) {
    return events[0];
  }

  const live = events.filter((event) => isEventLiveForPartyMode(event, now));
  const pool = live.length > 0 ? live : [...events];

  const inProgress = pool.filter((event) => {
    const end = partyModeEventEnd(event);
    return now >= event.startsAt && now <= end;
  });
  if (inProgress.length > 0) {
    return [...inProgress].sort(
      (a, b) => b.startsAt.getTime() - a.startsAt.getTime(),
    )[0];
  }

  const upcoming = pool.filter((event) => event.startsAt > now);
  if (upcoming.length > 0) {
    return [...upcoming].sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    )[0];
  }

  return [...pool].sort(
    (a, b) => partyModeEventEnd(b).getTime() - partyModeEventEnd(a).getTime(),
  )[0];
}
