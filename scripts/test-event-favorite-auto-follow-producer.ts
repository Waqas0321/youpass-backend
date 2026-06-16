/**
 * Verify favoriting an event auto-follows its producer.
 * Run: npx tsx scripts/test-event-favorite-auto-follow-producer.ts
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { createSession } from '../src/modules/auth/session.service.js';

const API = `http://localhost:${env.PORT}${env.API_PREFIX}`;

async function api(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  if (!user) {
    throw new Error('No active user found');
  }

  const event = await prisma.event.findFirst({
    where: {
      status: 'published',
      producerName: { not: null },
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: 'asc' },
  });

  if (!event?.producerName?.trim()) {
    throw new Error('No published future event with producer_name found');
  }

  const producer = await prisma.producer.findFirst({
    where: { name: { equals: event.producerName.trim(), mode: 'insensitive' } },
  });

  if (!producer) {
    throw new Error(
      `No producer record for event promoter "${event.producerName}". Add producer in admin first.`,
    );
  }

  await prisma.eventFavorite.deleteMany({
    where: { userId: user.id, eventId: event.id },
  });
  await prisma.producerFollow.deleteMany({
    where: { userId: user.id, producerId: producer.id },
  });

  const session = await createSession(user, {
    deviceInfo: { platform: 'event-favorite-auto-follow-test' },
  });

  const favorite = await api(`/users/me/favorites/events/${event.id}`, session.accessToken, {
    method: 'POST',
    body: '{}',
  });

  if (favorite.status !== 201 || !favorite.body?.success) {
    throw new Error(`Favorite event failed: ${JSON.stringify(favorite.body)}`);
  }

  const combined = await api('/users/me/favorites', session.accessToken);
  const producers = combined.body?.data?.producers ?? [];
  const followed = producers.some((item: { id: string }) => item.id === producer.id);

  const followRow = await prisma.producerFollow.findUnique({
    where: { userId_producerId: { userId: user.id, producerId: producer.id } },
  });

  console.log('Event:', event.title);
  console.log('Producer:', producer.name);
  console.log('Producer in GET /users/me/favorites:', followed ? 'YES' : 'NO');
  console.log('ProducerFollow row exists:', followRow ? 'YES' : 'NO');

  if (!followed || !followRow) {
    process.exit(1);
  }

  console.log('\nPASS: Event favorite auto-followed producer.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
