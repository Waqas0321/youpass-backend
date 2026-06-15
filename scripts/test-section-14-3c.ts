/**
 * Section 14.3C — waiting list endpoint smoke test.
 * Run: npx tsx scripts/test-section-14-3c.ts
 */
import { prisma } from '../src/config/database.js';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const TOKEN = process.env.TEST_USER_TOKEN;
const EVENT_ID = process.env.TEST_EVENT_ID;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  if (!TOKEN) {
    console.error('Set TEST_USER_TOKEN to a valid bearer token');
    process.exit(1);
  }

  const eventId =
    EVENT_ID ??
    (
      await prisma.event.findFirst({
        where: { status: 'published' },
        select: { id: true },
      })
    )?.id;

  if (!eventId) {
    console.error('No published event found. Set TEST_EVENT_ID.');
    process.exit(1);
  }

  console.log('Using event', eventId);

  const preview = await request(`/events/${eventId}/waitlist/preview`);
  console.log('GET /events/:id/waitlist/preview', preview.status, preview.body.success ? 'OK' : preview.body);

  const position = await request(`/events/${eventId}/waitlist/position`);
  console.log('GET /events/:id/waitlist/position', position.status, position.body.success ? 'OK' : position.body);

  const join = await request(`/events/${eventId}/waitlist/join`, { method: 'POST', body: '{}' });
  console.log('POST /events/:id/waitlist/join', join.status, join.body.success ? 'OK' : join.body);

  const list = await request('/users/me/invitations');
  const waitlistCount = list.body.data?.waitlist_entries?.length ?? 0;
  console.log('GET /users/me/invitations waitlist_entries', waitlistCount);

  const leave = await request(`/events/${eventId}/waitlist/leave`, { method: 'DELETE' });
  console.log('DELETE /events/:id/waitlist/leave', leave.status, leave.body.success ? 'OK' : leave.body);

  const system = await fetch(`${BASE}/system/invitations/process-waitlist-offers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key',
    },
    body: '{}',
  });
  const systemBody = await system.json();
  console.log('POST /system/invitations/process-waitlist-offers', system.status, systemBody.success ? 'OK' : systemBody);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
