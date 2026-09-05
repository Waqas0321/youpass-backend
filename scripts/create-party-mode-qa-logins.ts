/**
 * Create fresh consumer + staff QA logins with Party Mode ready.
 * Run: npx tsx scripts/create-party-mode-qa-logins.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import {
  STAFF_PERMISSIONS,
  DEFAULT_STAFF_ROLES,
  DEFAULT_STAFF_ZONES,
} from '../src/modules/admin/admin-staff.constants.js';
import {
  generateStaffQrToken,
  generateStaffQrPayload,
} from '../src/modules/staff/staff.utils.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

const CONSUMER_PHONE = '+56990000111';
const STAFF_PHONE = '+56990000222';
const SUPERVISOR_PIN = '1234';
const SANTIAGO_LAT = -33.4569;
const SANTIAGO_LNG = -70.6483;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

const SAMPLE_PRODUCTS = [
  {
    categorySlug: 'piscolas',
    name: 'Piscola',
    description: 'Pisco with cola',
    volumeMl: 350,
    priceClp: 4500,
    isRecommended: true,
    displayOrder: 1,
  },
  {
    categorySlug: 'cervezas',
    name: 'Corona',
    description: 'Imported lager',
    volumeMl: 330,
    priceClp: 3500,
    displayOrder: 2,
  },
  {
    categorySlug: 'energeticas',
    name: 'Jager Bomb',
    description: 'Jägermeister with energy drink',
    volumeMl: 250,
    priceClp: 8000,
    isRecommended: true,
    displayOrder: 3,
  },
] as const;

async function ensureBypassUserId(userId: string) {
  if (!fs.existsSync(envPath)) {
    console.warn('No .env file found; set PARTY_MODE_BYPASS_USER_IDS manually.');
    return;
  }

  const current = fs.readFileSync(envPath, 'utf8');
  const key = 'PARTY_MODE_BYPASS_USER_IDS';

  if (current.includes(`${key}=`)) {
    const updated = current.replace(new RegExp(`^${key}=.*$`, 'm'), (match) => {
      const existing = match.split('=')[1] ?? '';
      const ids = existing
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.includes(userId)) {
        return match;
      }
      return `${key}=${[...ids, userId].join(',')}`;
    });
    fs.writeFileSync(envPath, updated);
    return;
  }

  fs.appendFileSync(envPath, `\n${key}=${userId}\n`);
}

async function ensureConsumer() {
  const existing = await prisma.user.findFirst({ where: { phone: CONSUMER_PHONE } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      phone: CONSUMER_PHONE,
      countryCode: 'CL',
      preferredLanguage: 'es',
      fullName: 'Party QA Guest',
      rutOrPassport: 'QA-PARTY-GUEST-01',
      email: 'party.qa.guest@youpass.test',
      birthdate: new Date('1994-06-20'),
      gender: 'other',
      termsAcceptedAt: new Date(),
      category: 'bronze',
      accountStatus: 'active',
    },
  });
}

async function ensureStaff() {
  const permissionIds = STAFF_PERMISSIONS.map((permission) => permission.id);

  for (const role of DEFAULT_STAFF_ROLES) {
    await prisma.staffRole.upsert({
      where: { slug: role.slug },
      create: { ...role, isSystem: true },
      update: {
        label: role.label,
        color: role.color,
        displayOrder: role.displayOrder,
      },
    });
  }

  for (const zone of DEFAULT_STAFF_ZONES) {
    await prisma.staffZone.upsert({
      where: { slug: zone.slug },
      create: zone,
      update: { label: zone.label, displayOrder: zone.displayOrder },
    });
  }

  const role = await prisma.staffRole.findUniqueOrThrow({ where: { slug: 'bar' } });
  const zone = await prisma.staffZone.findUniqueOrThrow({
    where: { slug: 'barra_principal' },
  });

  let staff = await prisma.staffMember.findFirst({ where: { phone: STAFF_PHONE } });
  if (!staff) {
    staff = await prisma.staffMember.create({
      data: {
        name: 'Party QA Staff',
        phone: STAFF_PHONE,
        countryCode: 'CL',
        roleId: role.id,
        zoneId: zone.id,
        permissionIds,
        status: 'online',
        lastActivityAt: new Date(),
        supervisorPinHash: await hashOtp(SUPERVISOR_PIN),
        supervisorPinEncrypted: encryptSupervisorPin(SUPERVISOR_PIN),
      },
    });

    staff = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        qrToken: generateStaffQrToken(),
        qrPayload: generateStaffQrPayload(staff.id),
      },
    });
  } else {
    staff = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        name: 'Party QA Staff',
        permissionIds,
        supervisorPinHash: await hashOtp(SUPERVISOR_PIN),
        supervisorPinEncrypted: encryptSupervisorPin(SUPERVISOR_PIN),
        status: 'online',
      },
    });
  }

  return staff;
}

async function seedDrinksIfNeeded(eventId: string) {
  const existing = await prisma.eventDrinkProduct.count({
    where: { eventId, status: { not: 'hidden' } },
  });
  if (existing > 0) {
    return { seeded: false as const, existing };
  }

  await adminEventDrinksService.listCategories(eventId);
  const categories = await prisma.eventDrinkCategory.findMany({ where: { eventId } });
  const categoryBySlug = new Map(categories.map((row) => [row.slug, row.id]));

  let created = 0;
  for (const product of SAMPLE_PRODUCTS) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) continue;

    await adminEventDrinksService.createProduct(eventId, {
      category_id: categoryId,
      name: product.name,
      description: product.description,
      volume_ml: product.volumeMl,
      price_clp: product.priceClp,
      is_recommended: product.isRecommended ?? false,
      display_order: product.displayOrder,
      status: 'available',
    });
    created += 1;
  }

  return { seeded: true as const, created };
}

async function pickEvent() {
  const withDrinks = await prisma.eventDrinkProduct.findFirst({
    select: { eventId: true },
  });
  if (withDrinks) {
    const event = await prisma.event.findUnique({ where: { id: withDrinks.eventId } });
    if (event) return event;
  }

  return (
    (await prisma.event.findFirst({
      where: { status: 'published', countryCode: 'CL' },
      orderBy: { startsAt: 'asc' },
    })) ?? (await prisma.event.findFirst({ orderBy: { startsAt: 'asc' } }))
  );
}

async function ensurePaidValidatedTicket(userId: string, eventId: string, now: Date) {
  const producer =
    (await prisma.producer.findFirst()) ??
    (await prisma.producer.create({
      data: { name: 'YouPass Test Producer' },
    }));

  let invitation = await prisma.invitation.findFirst({
    where: { recipientUserId: userId, eventId },
    include: { ticket: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!invitation) {
    invitation = await prisma.invitation.create({
      data: {
        eventId,
        producerId: producer.id,
        recipientPhone: CONSUMER_PHONE,
        recipientUserId: userId,
        recipientName: 'Party QA Guest',
        type: 'free',
        tier: 'general',
        status: 'accepted',
        assignedSlot: 'General 1',
        entryValue: 10000,
        amountToPay: 0,
        cancellationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        source: 'guest',
        inviterUserId: userId,
        respondedAt: now,
        sentAt: now,
        chargeCurrency: 'CLP',
      },
      include: { ticket: true },
    });
  }

  let paidSlot = await prisma.ticketSlot.findFirst({
    where: {
      invitationId: invitation.id,
      order: { status: 'paid' },
    },
  });

  if (!paidSlot) {
    const order = await prisma.ticketOrder.create({
      data: {
        buyerUserId: userId,
        eventId,
        quantity: 1,
        tier: 'general',
        type: 'general',
        unitPrice: 10000,
        subtotalAmount: 10000,
        totalAmount: 10000,
        currency: 'CLP',
        status: 'paid',
        paymentReference: `party_qa_${Date.now()}`,
        slots: {
          create: {
            slotNumber: 1,
            status: 'owner',
            guestName: 'Party QA Guest',
            guestPhone: CONSUMER_PHONE,
            invitationId: invitation.id,
          },
        },
      },
    });
    paidSlot = await prisma.ticketSlot.findFirst({
      where: { orderId: order.id, slotNumber: 1 },
    });
  }

  const ticketId = crypto.randomBytes(12).toString('hex');
  if (!invitation.ticket) {
    await prisma.invitationTicket.create({
      data: {
        id: ticketId,
        invitationId: invitation.id,
        manualEntryId: `ME-${invitation.id.slice(-6).toUpperCase()}`,
        qrPayload: `yp:${ticketId}:${eventId}`,
        unlockAt: now,
        validatedAt: now,
      },
    });
  } else if (invitation.ticket.validatedAt == null) {
    await prisma.invitationTicket.update({
      where: { invitationId: invitation.id },
      data: { validatedAt: now, unlockAt: invitation.ticket.unlockAt ?? now },
    });
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'validated' },
  });

  return {
    invitationId: invitation.id,
    paidSlotId: paidSlot?.id ?? null,
  };
}

async function main() {
  const consumer = await ensureConsumer();
  const staff = await ensureStaff();

  const event = await pickEvent();
  if (!event) {
    throw new Error('No events found in database');
  }

  const now = new Date();
  const startsAt = new Date(now.getTime() - 60 * 60 * 1000);
  const endsAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const updatedEvent = await prisma.event.update({
    where: { id: event.id },
    data: {
      startsAt,
      endsAt,
      status: 'published',
      latitude: SANTIAGO_LAT,
      longitude: SANTIAGO_LNG,
    },
  });

  const drinks = await seedDrinksIfNeeded(updatedEvent.id);
  const ticket = await ensurePaidValidatedTicket(consumer.id, updatedEvent.id, now);
  await ensureBypassUserId(consumer.id);

  const partyMode = await partyModeService.resolveForUser(consumer.id, {
    lat: SANTIAGO_LAT,
    lng: SANTIAGO_LNG,
  });

  console.log(
    JSON.stringify(
      {
        consumer: {
          fullName: consumer.fullName,
          country: 'CL +56',
          phone: '990000111',
          e164: CONSUMER_PHONE,
          userId: consumer.id,
        },
        staff: {
          name: staff.name,
          country: 'CL +56',
          phone: '990000222',
          e164: STAFF_PHONE,
          staffId: staff.id,
          supervisorPin: SUPERVISOR_PIN,
        },
        event: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          startsAt: updatedEvent.startsAt,
          endsAt: updatedEvent.endsAt,
        },
        drinks,
        ticket,
        party_mode_at_venue: partyMode,
        next_steps: [
          'Add consumer userId to Vercel PARTY_MODE_BYPASS_USER_IDS and redeploy.',
          'Hot restart Flutter; login consumer and toggle Party Mode.',
          'Staff login uses staff app with supervisor PIN 1234.',
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
