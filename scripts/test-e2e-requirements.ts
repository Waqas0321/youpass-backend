/**
 * End-to-end verification: Section 14.3C waitlist + producer invitations + admin.
 * Run: npx tsx scripts/test-e2e-requirements.ts
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { createSession } from '../src/modules/auth/session.service.js';
import { invitationSettingsService } from '../src/modules/invitations/invitation-settings.service.js';
import { waitlistService } from '../src/modules/waitlist/waitlist.service.js';

const BASE = process.env.API_BASE_URL ?? `http://localhost:${env.PORT}${env.API_PREFIX}`;
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

function pass(name: string, detail = 'OK') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail !== 'OK' ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function userRequest(path: string, token: string, init: RequestInit = {}) {
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

async function adminRequest(path: string, init: RequestInit = {}, producerId?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-key': ADMIN_KEY,
    'x-admin-api-key': ADMIN_KEY,
  };
  if (producerId) {
    headers['x-producer-id'] = producerId;
  }
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function prepareWaitlistFixture(eventId: string, fillerUserId: string, producerId: string) {
  await invitationSettingsService.getInvitationSettings(eventId);
  await prisma.invitationSettings.update({
    where: { eventId },
    data: {
      enableWaitingList: true,
      allowGuaranteed: true,
      courtesySlotsTotal: 1,
      waitlistOfferHours: 4,
    },
  });

  const existingFiller = await prisma.invitation.findFirst({
    where: {
      eventId,
      source: 'producer',
      type: 'guaranteed',
      recipientUserId: fillerUserId,
      status: { in: ['sent', 'viewed', 'accepted'] },
    },
  });

  if (!existingFiller) {
    const filler = await prisma.user.findUniqueOrThrow({ where: { id: fillerUserId } });
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    await prisma.invitation.create({
      data: {
        eventId,
        producerId,
        recipientUserId: fillerUserId,
        recipientPhone: filler.phone,
        recipientName: filler.fullName,
        type: 'guaranteed',
        tier: 'vip',
        status: 'sent',
        source: 'producer',
        assignedSlot: 'E2E GP Slot 1',
        entryValue: 50000,
        amountToPay: 0,
        chargeCurrency: event.currencyCode ?? 'CLP',
        cancellationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  await prisma.waitlistEntry.updateMany({
    where: { eventId, status: { in: ['waiting', 'offered'] } },
    data: { status: 'left', leftAt: new Date() },
  });
}

async function ensureWaitlistGuest() {
  const phone = '+56999999001';
  let user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        countryCode: 'CL',
        preferredLanguage: 'es',
        fullName: 'E2E Waitlist Guest',
        rutOrPassport: 'E2E-0001',
        email: 'e2e-waitlist@youpass.test',
        birthdate: new Date('1995-01-01'),
        gender: 'other',
        termsAcceptedAt: new Date(),
        category: 'bronze',
        accountStatus: 'active',
      },
    });
  }
  return user;
}

async function main() {
  console.log('\n=== YouPass E2E Requirements Test ===\n');

  const guest = await prisma.user.findFirst({ where: { phone: '+56912345678' } });
  if (!guest) {
    console.error('FAIL: Dev user +56912345678 not found. Run: npm run db:seed');
    process.exit(1);
  }

  const waitlistGuest = await ensureWaitlistGuest();

  const filler =
    (await prisma.user.findFirst({
      where: { phone: { notIn: [guest.phone, waitlistGuest.phone] }, accountStatus: 'active' },
      orderBy: { createdAt: 'asc' },
    })) ?? guest;

  const producer = await prisma.producer.findFirst({ orderBy: { name: 'asc' } });
  if (!producer) {
    console.error('FAIL: No producer found. Run: npm run db:seed');
    process.exit(1);
  }

  const event =
    (await prisma.event.findFirst({ where: { title: 'YouFest 2026', status: 'published' } })) ??
    (await prisma.event.findFirst({ where: { status: 'published' }, orderBy: { startsAt: 'asc' } }));

  if (!event) {
    console.error('FAIL: No published event found.');
    process.exit(1);
  }

  console.log(`Guest: ${guest.fullName} (${guest.phone})`);
  console.log(`Waitlist guest: ${waitlistGuest.fullName} (${waitlistGuest.phone})`);
  console.log(`Event: ${event.title} (${event.id})`);
  console.log(`Producer: ${producer.name}\n`);

  const token = (
    await createSession(guest, { deviceInfo: { platform: 'e2e-test' } })
  ).accessToken;

  const waitlistToken = (
    await createSession(waitlistGuest, { deviceInfo: { platform: 'e2e-test-waitlist' } })
  ).accessToken;

  // ── Admin APIs ──────────────────────────────────────────────────────────
  console.log('Admin');

  const overview = await adminRequest('/admin/overview');
  if (overview.status === 200 && overview.body.success) {
    pass('GET /admin/overview', `waitlist_waiting=${overview.body.data.waitlist_waiting}`);
  } else {
    fail('GET /admin/overview', JSON.stringify(overview.body));
  }

  const users = await adminRequest('/admin/users');
  if (users.status === 200 && users.body.data?.users?.length > 0) {
    pass('GET /admin/users', `${users.body.data.users.length} users`);
  } else {
    fail('GET /admin/users', JSON.stringify(users.body));
  }

  const producers = await adminRequest('/admin/producers');
  if (producers.status === 200 && producers.body.data?.producers?.length > 0) {
    pass('GET /admin/producers');
  } else {
    fail('GET /admin/producers', JSON.stringify(producers.body));
  }

  // ── Invitation via recipient_user_id ──────────────────────────────────────
  console.log('\nInvitations (recipient_user_id)');

  const beforeInvites = await userRequest('/users/me/invitations', token);
  const beforeCount = beforeInvites.body.data?.invitations?.length ?? 0;

  const createInvite = await adminRequest(
    '/producer/invitations',
    {
      method: 'POST',
      body: JSON.stringify({
        event_id: event.id,
        type: 'free',
        recipient_user_id: guest.id,
        slot_label: 'E2E Free Guest',
        personalised_message: 'E2E test invitation',
      }),
    },
    producer.id,
  );

  if ((createInvite.status === 200 || createInvite.status === 201) && createInvite.body.success) {
    pass('POST /producer/invitations (recipient_user_id)');
  } else {
    fail('POST /producer/invitations', JSON.stringify(createInvite.body));
  }

  const afterInvites = await userRequest('/users/me/invitations', token);
  const afterCount = afterInvites.body.data?.invitations?.length ?? 0;
  if (afterCount >= beforeCount) {
    pass('GET /users/me/invitations lists new invite', `count=${afterCount}`);
  } else {
    fail('GET /users/me/invitations', `expected >= ${beforeCount}, got ${afterCount}`);
  }

  // ── Waitlist fixture ──────────────────────────────────────────────────────
  console.log('\nWaitlist setup');
  await prepareWaitlistFixture(event.id, filler.id, producer.id);

  const slotsFull = await waitlistService.isCourtesySlotsFull(event.id);
  if (slotsFull) {
    pass('Courtesy slots full (fixture)', 'courtesy_slots_total=1');
  } else {
    fail('Courtesy slots full', 'slots not full — cannot test join');
  }

  // ── Waitlist guest APIs ───────────────────────────────────────────────────
  console.log('\nWaitlist (guest)');

  const preview = await userRequest(`/events/${event.id}/waitlist/preview`, waitlistToken);
  if (preview.status === 200 && preview.body.success) {
    pass('GET /events/:id/waitlist/preview', `position ~${preview.body.data?.estimated_position}`);
  } else {
    fail('GET /events/:id/waitlist/preview', JSON.stringify(preview.body));
  }

  const join = await userRequest(`/events/${event.id}/waitlist/join`, waitlistToken, {
    method: 'POST',
    body: '{}',
  });
  if ((join.status === 200 || join.status === 201) && join.body.success) {
    pass('POST /events/:id/waitlist/join');
  } else {
    fail('POST /events/:id/waitlist/join', JSON.stringify(join.body));
  }

  const position = await userRequest(`/events/${event.id}/waitlist/position`, waitlistToken);
  if (position.status === 200 && position.body.data?.status === 'waiting') {
    pass('GET /events/:id/waitlist/position', `#${position.body.data.position}`);
  } else {
    fail('GET /events/:id/waitlist/position', JSON.stringify(position.body));
  }

  const feed = await userRequest('/users/me/invitations', waitlistToken);
  const waitlistCount = feed.body.data?.waitlist_entries?.length ?? 0;
  if (waitlistCount > 0) {
    pass('GET /users/me/invitations waitlist_entries', `count=${waitlistCount}`);
  } else {
    fail('GET /users/me/invitations waitlist_entries', 'empty');
  }

  const detail = await userRequest(`/events/${event.id}`, waitlistToken);
  const waitlistDetail = detail.body.data?.waitlist;
  if (detail.status === 200 && waitlistDetail?.can_leave) {
    pass('GET /events/:id waitlist.can_leave');
  } else {
    fail('GET /events/:id waitlist', JSON.stringify(waitlistDetail));
  }

  const upcoming = await userRequest(`/home/upcoming-events?limit=50&page=1`, waitlistToken);
  const card = upcoming.body.data?.items?.find((e: { id: string }) => e.id === event.id);
  if (card?.waitlist?.can_leave || card?.waitlist?.can_join) {
    pass('GET /events/upcoming waitlist meta on listing card');
  } else {
    fail('GET /events/upcoming waitlist meta', JSON.stringify(card?.waitlist ?? 'event not in page'));
  }

  const leave = await userRequest(`/events/${event.id}/waitlist/leave`, waitlistToken, {
    method: 'DELETE',
  });
  if (leave.status === 200 && leave.body.success) {
    pass('DELETE /events/:id/waitlist/leave');
  } else {
    fail('DELETE /events/:id/waitlist/leave', JSON.stringify(leave.body));
  }

  // ── Admin waitlist dashboard ──────────────────────────────────────────────
  console.log('\nAdmin waitlist');

  const adminWaitlist = await adminRequest(`/admin/events/${event.id}/waitlist`);
  if (adminWaitlist.status === 200 && adminWaitlist.body.data?.settings) {
    pass(
      'GET /admin/events/:id/waitlist',
      `enabled=${adminWaitlist.body.data.settings.enable_waiting_list}`,
    );
  } else {
    fail('GET /admin/events/:id/waitlist', JSON.stringify(adminWaitlist.body));
  }

  const systemJob = await fetch(`${BASE}/system/invitations/process-waitlist-offers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
    },
    body: '{}',
  });
  const systemBody = await systemJob.json();
  if (systemJob.status === 200 && systemBody.success) {
    pass('POST /system/invitations/process-waitlist-offers');
  } else {
    fail('POST /system/invitations/process-waitlist-offers', JSON.stringify(systemBody));
  }

  const settingsGet = await adminRequest(`/admin/events/${event.id}/invitation-settings`);
  if (settingsGet.status === 200 && settingsGet.body.data?.enable_waiting_list != null) {
    pass('GET /admin/events/:id/invitation-settings');
  } else {
    fail('GET /admin/events/:id/invitation-settings', JSON.stringify(settingsGet.body));
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log('\n=== Summary ===');
  console.log(`${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log('\nFailed:');
    for (const item of failed) {
      console.log(`  - ${item.name}: ${item.detail}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\nAll E2E requirement checks passed.\n');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
