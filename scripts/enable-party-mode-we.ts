import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/config/database.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

const PHONE = '+56912345678';
const VENUE_LAT = 31.4187;
const VENUE_LNG = 73.0791;

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
    return false;
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
    return true;
  }

  fs.appendFileSync(envPath, `\n${key}=${userId}\n`);
  return true;
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
    if (!categoryId) {
      continue;
    }

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
    if (event) {
      return event;
    }
  }

  const published = await prisma.event.findFirst({
    where: { status: 'published', countryCode: 'CL' },
    orderBy: { startsAt: 'asc' },
  });
  if (published) {
    return published;
  }

  return prisma.event.findFirst({ orderBy: { startsAt: 'asc' } });
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
        recipientPhone: PHONE,
        recipientUserId: userId,
        recipientName: 'we',
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
        paymentReference: `party_mode_${Date.now()}`,
        slots: {
          create: {
            slotNumber: 1,
            status: 'owner',
            guestName: 'we',
            guestPhone: PHONE,
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
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { preferredLanguage: 'en' },
  });

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
      latitude: VENUE_LAT,
      longitude: VENUE_LNG,
    },
  });

  const drinks = await seedDrinksIfNeeded(updatedEvent.id);
  const ticket = await ensurePaidValidatedTicket(user.id, updatedEvent.id, now);
  await ensureBypassUserId(user.id);

  // Bypass is env-loaded at process start; force-check geofenced path too.
  const partyModeBypassLike = await partyModeService.resolveForUser(user.id, {
    lat: VENUE_LAT,
    lng: VENUE_LNG,
  });

  console.log(
    JSON.stringify(
      {
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.fullName,
          preferredLanguage: 'en',
        },
        event: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          startsAt: updatedEvent.startsAt,
          endsAt: updatedEvent.endsAt,
          latitude: updatedEvent.latitude,
          longitude: updatedEvent.longitude,
        },
        drinks,
        ticket,
        party_mode_at_venue: partyModeBypassLike,
        next_steps: [
          'Restart local backend so PARTY_MODE_BYPASS_USER_IDS includes this user.',
          'If the app uses production API, add the user id to Vercel PARTY_MODE_BYPASS_USER_IDS and redeploy.',
          'Hot restart Flutter, pull to refresh Home, then toggle Party Mode.',
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
  .finally(async () => {
    await prisma.$disconnect();
  });
