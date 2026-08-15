import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';
import {
  isEventLiveForPartyMode,
  selectEventByDateTime,
} from '../src/modules/party-mode/party-mode.selection.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function hoursFrom(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

async function main() {
  const anonymous = await partyModeService.resolveForUser(undefined, {
    lat: -33.4489,
    lng: -70.6693,
  });
  assert(!anonymous.enabled, 'anonymous users should not get party mode');
  assert(!anonymous.banner_visible, 'anonymous users should not see banner');

  const now = new Date('2026-08-11T20:00:00.000Z');

  const tonight = {
    id: 'tonight',
    title: 'Tonight Live',
    startsAt: hoursFrom(now, -1),
    endsAt: hoursFrom(now, 4),
  };
  const tomorrow = {
    id: 'tomorrow',
    title: 'Tomorrow Show',
    startsAt: hoursFrom(now, 22),
    endsAt: hoursFrom(now, 28),
  };
  const yesterday = {
    id: 'yesterday',
    title: 'Yesterday Afterparty Window',
    startsAt: hoursFrom(now, -10),
    endsAt: hoursFrom(now, -4),
  };
  const nextWeek = {
    id: 'next-week',
    title: 'Next Week',
    startsAt: hoursFrom(now, 24 * 7),
    endsAt: hoursFrom(now, 24 * 7 + 5),
  };

  assert(isEventLiveForPartyMode(tonight, now), 'tonight should be live');
  assert(
    isEventLiveForPartyMode(yesterday, now),
    'yesterday should still be in post-event window',
  );
  assert(
    !isEventLiveForPartyMode(nextWeek, now),
    'next week should not be live yet',
  );

  const amongMultipleActive = selectEventByDateTime(
    [tomorrow, yesterday, tonight, nextWeek],
    now,
  );
  assert(
    amongMultipleActive?.id === 'tonight',
    `expected in-progress event when multiple active tickets exist, got ${amongMultipleActive?.id}`,
  );

  const preWindowNow = hoursFrom(tomorrow.startsAt, -1);
  const amongUpcoming = selectEventByDateTime(
    [nextWeek, tomorrow, yesterday],
    preWindowNow,
  );
  assert(
    amongUpcoming?.id === 'tomorrow',
    `expected soonest upcoming live event, got ${amongUpcoming?.id}`,
  );

  const postOnlyNow = hoursFrom(yesterday.endsAt!, 2);
  const amongPost = selectEventByDateTime([yesterday, nextWeek], postOnlyNow);
  assert(
    amongPost?.id === 'yesterday',
    `expected recently ended event in post window, got ${amongPost?.id}`,
  );

  console.log('party-mode service smoke + multi-ticket schedule checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
