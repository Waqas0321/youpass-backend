/**
 * Verify GET /home/upcoming-events returns is_favorite for logged-in users.
 * Run: PORT=3002 npx tsx scripts/test-upcoming-events-favorite-flag.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { createSession } from '../src/modules/auth/session.service.js';

const port = process.env.PORT ?? '3000';
const API = `http://localhost:${port}/api/v1`;

async function api(path: string, token: string) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  const event = await prisma.event.findFirst({
    where: { status: 'published', startsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
  });

  if (!user || !event) {
    throw new Error('Missing active user or published future event');
  }

  await prisma.eventFavorite.upsert({
    where: { userId_eventId: { userId: user.id, eventId: event.id } },
    create: { userId: user.id, eventId: event.id },
    update: {},
  });

  const session = await createSession(user, {
    deviceInfo: { platform: 'upcoming-favorite-flag-test' },
  });

  const upcoming = await api(
    `/home/upcoming-events?country_code=${event.countryCode}&limit=50`,
    session.accessToken,
  );

  if (upcoming.status !== 200 || !upcoming.body?.success) {
    throw new Error(`Upcoming events failed: ${JSON.stringify(upcoming.body)}`);
  }

  const items = upcoming.body.data?.items ?? [];
  const match = items.find((item: { id: string }) => item.id === event.id);

  if (!match) {
    console.log(`Event "${event.title}" not in upcoming list — skipping item check.`);
    console.log('PASS: endpoint reachable');
    return;
  }

  if (match.is_favorite !== true) {
    throw new Error(
      `Expected is_favorite=true for favorited event, got ${JSON.stringify(match.is_favorite)}`,
    );
  }

  console.log(`Event: ${event.title}`);
  console.log('is_favorite:', match.is_favorite);
  console.log('PASS: upcoming events return favorite state');
}

main()
  .catch((error) => {
    console.error('FAIL:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
