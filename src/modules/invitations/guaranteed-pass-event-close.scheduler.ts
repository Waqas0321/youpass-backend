import { prisma } from '../../config/database.js';
import { eventEndAt } from '../tickets/tickets.utils.js';
import { invitationNoShowChargeService } from './invitation-no-show-charge.service.js';

const EVENT_CLOSE_INTERVAL_MS = 15 * 60 * 1000;

export async function processEndedEventsForNoShows(now = new Date()): Promise<number> {
  const events = await prisma.event.findMany({
    where: {
      status: 'published',
      startsAt: { lte: now },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      title: true,
    },
  });

  let processed = 0;

  for (const event of events) {
    const closeAt = event.endsAt ?? eventEndAt(event.startsAt);
    if (now < closeAt) {
      continue;
    }

    const result = await invitationNoShowChargeService.processNoShowsForEvent(event.id);
    if (result.charged > 0) {
      console.log(
        `[gp-event-close] Event "${event.title}" — charged ${result.charged} no-show(s)`,
      );
      processed += 1;
    }
  }

  return processed;
}

export function startGuaranteedPassEventCloseScheduler(): void {
  const run = async () => {
    try {
      await processEndedEventsForNoShows();
    } catch (error) {
      console.error('[gp-event-close] Scheduler failed:', error);
    }
  };

  void run();
  setInterval(run, EVENT_CLOSE_INTERVAL_MS);
}
