import 'dotenv/config';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { waitlistService } from '../src/modules/waitlist/waitlist.service.js';
import { createSession } from '../src/modules/auth/session.service.js';

const BASE = process.env.API_BASE_URL ?? `http://localhost:${env.PORT}${env.API_PREFIX}`;

async function request(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: '+56912345678' } });
  if (!user) {
    console.error('Missing dev user +56912345678 — run npm run db:seed first');
    process.exit(1);
  }

  const token = (
    await createSession(user, {
      deviceInfo: { platform: 'audit-script' },
    })
  ).accessToken;

  const events = await prisma.event.findMany({
    where: { status: 'published' },
    take: 5,
    select: { id: true, title: true },
  });

  console.log('=== Waitlist audit ===');
  console.log('User:', user.fullName, user.phone);
  console.log('Published events sample:', events.length);

  for (const event of events) {
    const settings = await prisma.invitationSettings.findUnique({ where: { eventId: event.id } });
    const slotsFull = await waitlistService.isCourtesySlotsFull(event.id);
    const waiting = await prisma.waitlistEntry.count({
      where: { eventId: event.id, status: 'waiting' },
    });
    console.log(`\n${event.title} (${event.id})`);
    console.log('  settings:', settings
      ? {
          enable_waiting_list: settings.enableWaitingList,
          courtesy_slots_total: settings.courtesySlotsTotal,
          waitlist_offer_hours: settings.waitlistOfferHours,
        }
      : 'MISSING — defaults apply on first read');
    console.log('  courtesy_slots_full:', slotsFull);
    console.log('  queue_size:', waiting);
  }

  const youfest = await prisma.event.findFirst({
    where: { title: 'YouFest 2026' },
    select: { id: true },
  });
  const testEventId = youfest?.id ?? events[0]?.id;
  if (!testEventId) {
    console.error('No event to test');
    process.exit(1);
  }

  console.log('\n=== API smoke (event:', testEventId, ') ===');
  const preview = await request(`/events/${testEventId}/waitlist/preview`, token);
  console.log('preview', preview.status, preview.body.success ? preview.body.data : preview.body);

  const join = await request(`/events/${testEventId}/waitlist/join`, token, {
    method: 'POST',
    body: '{}',
  });
  console.log('join', join.status, join.body.success ? 'OK' : join.body);

  const invitations = await request('/users/me/invitations', token);
  const waitlistEntries = invitations.body.data?.waitlist_entries?.length ?? 0;
  console.log('invitations waitlist_entries', waitlistEntries);

  const listing = await request('/events/upcoming?limit=3', token);
  const firstWaitlist = listing.body.data?.events?.[0]?.waitlist;
  console.log('upcoming listing waitlist meta sample:', firstWaitlist ?? 'none');

  const adminKey = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';
  const adminWaitlist = await fetch(`${BASE}/admin/events/${testEventId}/waitlist`, {
    headers: { 'x-admin-key': adminKey },
  });
  const adminBody = await adminWaitlist.json();
  console.log('admin waitlist dashboard', adminWaitlist.status, adminBody.success ? 'OK' : adminBody);

  if (join.body.success) {
    const leave = await request(`/events/${testEventId}/waitlist/leave`, token, {
      method: 'DELETE',
    });
    console.log('leave (cleanup)', leave.status, leave.body.success ? 'OK' : leave.body);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
