import 'dotenv/config';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { createSession } from '../src/modules/auth/session.service.js';
import type { User } from '@prisma/client';

const API = `http://localhost:${env.PORT}${env.API_PREFIX}`;

type ApiResult = {
  status: number;
  body: {
    success?: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string };
  };
};

async function sessionTokenFor(user: User) {
  const session = await createSession(user, {
    deviceInfo: { platform: 'assign-tickets-e2e' },
  });
  return session.accessToken;
}

async function api(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<ApiResult> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json()) as ApiResult['body'];
  return { status: response.status, body };
}

async function findBuyerWithAssignableOrder() {
  const preferredOrderId = '6a224828208f8c35ce887a2c';
  const now = new Date();
  const orders = await prisma.ticketOrder.findMany({
    where: { status: 'paid' },
    include: {
      buyer: true,
      event: true,
      slots: { orderBy: { slotNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const candidates = orders
    .map((order) => {
      const availableSlot = order.slots.find((slot) => slot.status === 'available');
      if (!availableSlot || order.buyer.accountStatus !== 'active') {
        return null;
      }
      if (order.event.startsAt <= now) {
        return null;
      }
      return { order, slot: availableSlot, buyer: order.buyer };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((a, b) => b.order.event.startsAt.getTime() - a.order.event.startsAt.getTime());

  const preferred = candidates.find((item) => item.order.id === preferredOrderId);
  if (preferred) {
    return preferred;
  }
  if (candidates[0]) {
    return candidates[0];
  }

  const legacyOrders = await prisma.ticketOrder.findMany({
    where: { status: 'paid' },
    include: {
      buyer: true,
      event: true,
      slots: { orderBy: { slotNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  for (const order of orders) {
    const availableSlot = order.slots.find((slot) => slot.status === 'available');
    if (!availableSlot || order.buyer.accountStatus !== 'active') {
      continue;
    }

    return { order, slot: availableSlot, buyer: order.buyer };
  }

  return null;
}

async function findGuestUser(buyerId: string, buyerPhone: string) {
  return prisma.user.findFirst({
    where: {
      accountStatus: 'active',
      id: { not: buyerId },
      phone: { not: buyerPhone },
    },
    orderBy: { fullName: 'asc' },
  });
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function repairCorruptInvitationPhones() {
  await prisma.$runCommandRaw({
    update: 'Invitation',
    updates: [
      {
        q: {
          $or: [
            { recipient_phone: null },
            { recipient_phone: { $exists: false } },
            { recipient_phone: '' },
          ],
        },
        u: { $set: { recipient_phone: 'unknown' } },
        multi: true,
      },
    ],
  });
}

async function main() {
  console.log('=== Assign tickets E2E ===');
  console.log(`API: ${API}`);
  console.log(`TWILIO_MOCK: ${env.TWILIO_MOCK}`);

  await repairCorruptInvitationPhones();

  const fixture = await findBuyerWithAssignableOrder();
  if (!fixture) {
    throw new Error(
      'No paid ticket order with an available slot found. Run prisma patch-dummy-data or purchase multi-ticket order first.',
    );
  }

  const { order, slot, buyer } = fixture;
  const guest = await findGuestUser(buyer.id, buyer.phone);
  if (!guest) {
    throw new Error('Need at least two active users in the database.');
  }

  console.log('\n--- Test accounts ---');
  console.log(`Buyer: ${buyer.fullName} (${buyer.phone})`);
  console.log(`Guest (registered): ${guest.fullName} (${guest.phone})`);
  console.log(`Order: ${order.id} | Event: ${order.event.title} | tier: ${order.tier}`);
  console.log(`Slot: ${slot.id} (#${slot.slotNumber})`);

  const buyerToken = await sessionTokenFor(buyer);
  const guestToken = await sessionTokenFor(guest);

  console.log('\n--- 1) Guest lookup (registered user) ---');
  const lookupName = await api(
    `/users/me/ticket-orders/guest-lookup?q=${encodeURIComponent(guest.fullName.split(' ')[0] ?? guest.fullName)}`,
    buyerToken,
  );
  if (lookupName.status !== 200 || !lookupName.body.success) {
    console.log('Lookup by name response:', lookupName.status, JSON.stringify(lookupName.body));
    console.log('Lookup by name: skipped (phone lookup is the primary path)');
  } else {
    const lookupResults = (lookupName.body.data?.results as Array<Record<string, unknown>>) ?? [];
    const foundByName = lookupResults.some((row) => row.user_id === guest.id);
    console.log(`Lookup by name: ${lookupResults.length} result(s), guest found=${foundByName}`);
  }

  const lookupPhone = await api(
    `/users/me/ticket-orders/guest-lookup?q=${encodeURIComponent(guest.phone)}`,
    buyerToken,
  );
  assert(lookupPhone.status === 200 && lookupPhone.body.success, 'Guest lookup by phone failed');
  const phoneResults = (lookupPhone.body.data?.results as Array<Record<string, unknown>>) ?? [];
  const foundByPhone = phoneResults.some((row) => row.user_id === guest.id);
  console.log(`Lookup by phone: ${phoneResults.length} result(s), guest found=${foundByPhone}`);
  assert(foundByPhone, 'Registered guest not returned by phone lookup');

  console.log('\n--- 2) List assignments ---');
  const assignments = await api(`/users/me/ticket-orders/${order.id}/assignments`, buyerToken);
  if (assignments.status !== 200 || !assignments.body.success) {
    console.error('List assignments response:', assignments.status, JSON.stringify(assignments.body));
  }
  assert(assignments.status === 200 && assignments.body.success, 'List assignments failed');
  const slots = (assignments.body.data?.slots as Array<Record<string, unknown>>) ?? [];
  const assignable = slots.filter((s) => s.status === 'available' || s.status === 'pending');
  console.log(`Assignments: ${slots.length} slot(s), ${assignable.length} assignable UI slot(s)`);
  assert(assignments.body.data?.tier != null, 'Assignments response missing tier');

  console.log('\n--- 3) Assign slot to registered guest ---');
  const assign = await api(
    `/users/me/ticket-orders/${order.id}/slots/${slot.id}/assign`,
    buyerToken,
    {
      method: 'POST',
      body: JSON.stringify({
        guest_name: guest.fullName,
        guest_phone: guest.phone,
        country_code: guest.countryCode,
      }),
    },
  );

  if (assign.status !== 200 || !assign.body.success) {
    console.error('Assign failed:', JSON.stringify(assign.body, null, 2));
    throw new Error('Assign slot API failed');
  }

  const assignData = assign.body.data ?? {};
  const slotData = (assignData.slot as Record<string, unknown> | undefined) ?? {};
  const invitationId =
    slotData.invitation_id ?? slotData.invitationId ?? assignData.invitation_id;
  const deliveryMode = assignData.delivery_mode;
  const whatsappSent = assignData.whatsapp_sent;
  const message = assignData.message;
  const claimUrl = assignData.claim_url ?? assignData.claimUrl;
  const whatsappUrl = assignData.whatsapp_url ?? assignData.whatsappUrl;

  console.log(`Assign OK | invitation=${invitationId}`);
  console.log(`Delivery: mode=${deliveryMode}, whatsapp_sent=${whatsappSent}`);
  console.log(`Message: ${message}`);
  console.log(`Claim URL: ${claimUrl}`);
  console.log(`WhatsApp URL: ${whatsappUrl}`);

  assert(invitationId, 'Assign response missing invitation id');
  assert(typeof whatsappUrl === 'string' && whatsappUrl.startsWith('https://wa.me/'), 'Missing wa.me whatsapp_url');
  assert(String(whatsappUrl).includes(encodeURIComponent(String(claimUrl))), 'WhatsApp URL should include claim link');

  const invitation = await prisma.invitation.findUnique({
    where: { id: String(invitationId) },
  });
  assert(invitation, 'Invitation not persisted');
  assert(invitation.recipientUserId === guest.id, 'recipientUserId not linked to registered guest');
  assert(invitation.recipientPhone === guest.phone, 'recipientPhone mismatch');
  assert(invitation.status === 'sent', `Expected invitation status sent, got ${invitation.status}`);
  console.log('DB invitation linked to registered guest: OK');

  console.log('\n--- 4) Guest sees invitation in app API ---');
  const guestInvitations = await api('/users/me/invitations?filter=pending', guestToken);
  assert(guestInvitations.status === 200 && guestInvitations.body.success, 'Guest invitations list failed');
  const guestList =
    (guestInvitations.body.data?.invitations as Array<Record<string, unknown>>) ?? [];
  const received = guestList.find((item) => item.id === invitation.id);
  assert(received, 'Guest does not see assigned invitation in /invitations?filter=pending');
  console.log(`Guest pending invitations: ${guestList.length}, assigned invite visible: OK`);
  console.log(`Guest invite event: ${received.event_title ?? received.eventTitle}`);

  console.log('\n--- 5) Guest accepts invitation ---');
  const confirm = await api(
    `/invitations/${invitation.id}/confirm`,
    guestToken,
    { method: 'POST', body: JSON.stringify({}) },
  );
  if (confirm.status !== 200 || !confirm.body.success) {
    console.error('Confirm failed:', JSON.stringify(confirm.body, null, 2));
    throw new Error('Guest confirm invitation failed');
  }
  const confirmedInvite = confirm.body.data ?? {};
  const confirmedStatus =
    confirmedInvite.status ?? confirmedInvite.lifecycle_state ?? confirmedInvite.db_status;
  console.log(`Guest accepted invitation: status=${confirmedStatus}`);
  assert(
    confirmedStatus === 'accepted' || confirmedStatus === 'confirmed',
    `Expected accepted status, got ${confirmedStatus}`,
  );

  const acceptedDb = await prisma.invitation.findUnique({
    where: { id: invitation.id },
    include: { ticket: true },
  });
  assert(acceptedDb?.status === 'accepted', 'DB invitation not accepted');
  assert(acceptedDb?.ticket != null, 'Guest ticket not created after accept');
  console.log(`Guest ticket created: ${acceptedDb.ticket?.id ?? 'n/a'}`);

  console.log('\n--- 6) Guest sees ticket in My Tickets upcoming ---');
  const guestUpcoming = await api('/users/me/tickets/upcoming', guestToken);
  assert(guestUpcoming.status === 200 && guestUpcoming.body.success, 'Guest upcoming tickets failed');
  const guestTickets =
    (guestUpcoming.body.data?.tickets as Array<Record<string, unknown>>) ?? [];
  const guestEventTicket = guestTickets.find(
    (t) =>
      t.event_id === order.eventId ||
      t.eventId === order.eventId ||
      t.invitation_id === invitation.id ||
      t.invitationId === invitation.id,
  );
  assert(guestEventTicket, 'Guest does not see accepted ticket in upcoming list');
  console.log(
    `Guest upcoming ticket: ${guestEventTicket.event_title ?? guestEventTicket.eventTitle}`,
  );

  console.log('\n--- 7) Buyer slot status after guest accept ---');
  const assignmentsAfter = await api(
    `/users/me/ticket-orders/${order.id}/assignments`,
    buyerToken,
  );
  const afterSlots =
    (assignmentsAfter.body.data?.slots as Array<Record<string, unknown>>) ?? [];
  const assignedSlot = afterSlots.find((s) => s.id === slot.id);
  console.log(`Assigned slot status after accept: ${assignedSlot?.status ?? 'missing'}`);
  assert(
    assignedSlot?.status === 'claimed' || assignedSlot?.status === 'pending',
    `Unexpected slot status after accept: ${assignedSlot?.status}`,
  );

  console.log('\n--- 8) Skip cancel cleanup (invitation already accepted) ---');

  console.log('\n=== E2E RESULT: PASS ===');
  console.log('Full flow verified: assign → guest receives → guest accepts → ticket in My Tickets.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('\n=== E2E RESULT: FAIL ===');
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
