/**
 * Seed demo data for Invite Test Guest (+56988777123) so customer app
 * screens (profile, tickets, wallet, favorites, invitations) look complete.
 *
 * Run: npx tsx scripts/seed-invite-test-guest.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../src/config/database.js';
import {
  generateEntryCode,
  generateQrPayload,
} from '../src/modules/invitations/invitations.utils.js';

const PHONE = '+56988777123';
const PHOTO_URL =
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop';

async function getOrCreateProducer(name: string) {
  const existing = await prisma.producer.findFirst({ where: { name } });
  if (existing) {
    return existing;
  }
  return prisma.producer.create({ data: { name, logoUrl: null } });
}

async function ensureUpcomingChileEvents() {
  const now = new Date();
  let events = await prisma.event.findMany({
    where: {
      countryCode: 'CL',
      status: 'published',
      startsAt: { gte: now },
    },
    include: { eventType: true },
    orderBy: { startsAt: 'asc' },
    take: 4,
  });

  if (events.length >= 3) {
    return events;
  }

  const eventType =
    (await prisma.eventType.findFirst({ where: { slug: 'concerts' } })) ??
    (await prisma.eventType.findFirst());
  if (!eventType) {
    throw new Error('No event types in database — run prisma seed first.');
  }

  const templates = [
    {
      title: 'Festival Verano 2026',
      venueName: 'Club Amanda',
      city: 'Santiago',
      startsAt: new Date('2026-11-15T22:00:00.000Z'),
      imageUrl: 'https://images.unsplash.com/photo-1459749411177-0410a7948c1a?w=800',
    },
    {
      title: 'Concierto X',
      venueName: 'Movistar Arena',
      city: 'Santiago',
      startsAt: new Date('2026-09-22T21:00:00.000Z'),
      imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    },
    {
      title: 'YouFest 2026',
      venueName: 'Centro Eventos Hilaria',
      city: 'Concepción',
      startsAt: new Date('2026-12-04T22:00:00.000Z'),
      imageUrl: 'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
    },
  ];

  for (const template of templates) {
    const existing = await prisma.event.findFirst({
      where: { title: template.title, city: template.city },
    });
    if (existing) {
      if (existing.startsAt < now) {
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            startsAt: template.startsAt,
            status: 'published',
            countryCode: 'CL',
            currencyCode: 'CLP',
          },
        });
      }
      continue;
    }

    await prisma.event.create({
      data: {
        title: template.title,
        venueName: template.venueName,
        city: template.city,
        countryCode: 'CL',
        currencyCode: 'CLP',
        startsAt: template.startsAt,
        imageUrl: template.imageUrl,
        eventTypeId: eventType.id,
        status: 'published',
        minPrice: 18000,
      },
    });
  }

  events = await prisma.event.findMany({
    where: {
      countryCode: 'CL',
      status: 'published',
      startsAt: { gte: now },
    },
    include: { eventType: true },
    orderBy: { startsAt: 'asc' },
    take: 4,
  });

  if (events.length < 2) {
    throw new Error('Could not find or create enough upcoming Chile events.');
  }
  return events;
}

async function ensureOwnedTicket(params: {
  userId: string;
  phone: string;
  eventId: string;
  producerId: string;
  startsAt: Date;
  unitPrice: number;
  slotLabel: string;
}) {
  const existing = await prisma.invitation.findFirst({
    where: {
      recipientUserId: params.userId,
      eventId: params.eventId,
      status: { in: ['accepted', 'validated'] },
      ticket: { isNot: null },
    },
  });
  if (existing) {
    return existing.id;
  }

  const order = await prisma.ticketOrder.create({
    data: {
      buyerUserId: params.userId,
      eventId: params.eventId,
      quantity: 2,
      tier: 'general',
      type: 'general',
      unitPrice: params.unitPrice,
      subtotalAmount: params.unitPrice * 2,
      serviceFeeRate: 0.05,
      serviceFeeAmount: Math.round(params.unitPrice * 2 * 0.05),
      totalAmount: params.unitPrice * 2 + Math.round(params.unitPrice * 2 * 0.05),
      currency: 'CLP',
      status: 'paid',
      paymentReference: `seed_kushki_${crypto.randomBytes(4).toString('hex')}`,
    },
  });

  const ownerSlot = await prisma.ticketSlot.create({
    data: {
      orderId: order.id,
      slotNumber: 1,
      status: 'owner',
    },
  });
  await prisma.ticketSlot.create({
    data: {
      orderId: order.id,
      slotNumber: 2,
      status: 'available',
    },
  });

  const invitation = await prisma.invitation.create({
    data: {
      eventId: params.eventId,
      producerId: params.producerId,
      recipientUserId: params.userId,
      recipientPhone: params.phone,
      recipientName: 'Invite Test Guest',
      inviterUserId: params.userId,
      source: 'guest',
      type: 'free',
      tier: 'general',
      status: 'accepted',
      assignedSlot: params.slotLabel,
      entryValue: params.unitPrice,
      amountToPay: 0,
      cancellationDeadline: new Date(params.startsAt.getTime() - 24 * 60 * 60 * 1000),
      respondedAt: new Date(),
      sentAt: new Date(),
    },
  });

  const ticketId = crypto.randomBytes(12).toString('hex');
  await prisma.invitationTicket.create({
    data: {
      id: ticketId,
      invitationId: invitation.id,
      manualEntryId: generateEntryCode(),
      qrPayload: generateQrPayload(ticketId, params.eventId),
      unlockAt: new Date(),
    },
  });

  await prisma.ticketSlot.update({
    where: { id: ownerSlot.id },
    data: { invitationId: invitation.id, status: 'owner' },
  });

  return invitation.id;
}

async function ensurePendingInvitation(params: {
  userId: string;
  phone: string;
  eventId: string;
  producerId: string;
  startsAt: Date;
}) {
  const existing = await prisma.invitation.findFirst({
    where: {
      recipientUserId: params.userId,
      eventId: params.eventId,
      status: { in: ['sent', 'viewed'] },
    },
  });
  if (existing) {
    return existing.id;
  }

  return prisma.invitation
    .create({
      data: {
        eventId: params.eventId,
        producerId: params.producerId,
        recipientUserId: params.userId,
        recipientPhone: params.phone,
        recipientName: 'Invite Test Guest',
        source: 'producer',
        type: 'guaranteed',
        tier: 'vip',
        status: 'sent',
        assignedSlot: 'VIP A1',
        entryValue: 35000,
        amountToPay: 0,
        cancellationDeadline: new Date(params.startsAt.getTime() - 3 * 24 * 60 * 60 * 1000),
        sentAt: new Date(),
        customMessage: 'Te esperamos en VIP — Invite Test Guest',
      },
    })
    .then((row) => row.id);
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: PHONE },
  });
  if (!user) {
    throw new Error(`User ${PHONE} not found. Register Invite Test Guest first.`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      instagramUsername: 'invitetestguest',
      profilePhotoUrl: PHOTO_URL,
      preferredLanguage: 'en',
      countryCode: 'CL',
    },
  });

  await prisma.userProfileCompletion.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      hasPhoto: true,
      hasInstagram: true,
      completionPercentage: 100,
      bannerDismissedAt: new Date(),
    },
    update: {
      hasPhoto: true,
      hasInstagram: true,
      completionPercentage: 100,
      bannerDismissedAt: new Date(),
    },
  });

  const existingCard = await prisma.userPaymentMethod.findFirst({
    where: { userId: user.id },
  });
  if (!existingCard) {
    await prisma.userPaymentMethod.create({
      data: {
        userId: user.id,
        providerToken: `kushki_tok_seed_${crypto.randomBytes(4).toString('hex')}`,
        gateway: 'kushki',
        brand: 'visa',
        lastFour: '4242',
        expirationMonth: 12,
        expirationYear: 2028,
        cardholderName: 'Invite Test Guest',
        isDefault: true,
      },
    });
  }

  const producer = await getOrCreateProducer('YouPass');
  const sunset = await getOrCreateProducer('Sunset Productions');
  const events = await ensureUpcomingChileEvents();
  const ticketEvents = events.slice(0, 2);
  const inviteEvent = events[2] ?? events[0]!;

  const ticketIds: string[] = [];
  for (const [index, event] of ticketEvents.entries()) {
    const id = await ensureOwnedTicket({
      userId: user.id,
      phone: user.phone,
      eventId: event.id,
      producerId: producer.id,
      startsAt: event.startsAt,
      unitPrice: index === 0 ? 18000 : 25000,
      slotLabel: index === 0 ? 'General A12' : 'General B04',
    });
    ticketIds.push(id);

    await prisma.eventFavorite.upsert({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
      create: { userId: user.id, eventId: event.id },
      update: {},
    });
  }

  await prisma.producerFollow.upsert({
    where: { userId_producerId: { userId: user.id, producerId: sunset.id } },
    create: { userId: user.id, producerId: sunset.id },
    update: {},
  });

  const pendingId = await ensurePendingInvitation({
    userId: user.id,
    phone: user.phone,
    eventId: inviteEvent.id,
    producerId: sunset.id,
    startsAt: inviteEvent.startsAt,
  });

  console.log('Seeded Invite Test Guest');
  console.log('  User:', user.fullName, user.phone);
  console.log('  Profile: photo + Instagram @invitetestguest (100%)');
  console.log('  Wallet card: Visa ••••4242 (Kushki)');
  console.log('  Tickets:', ticketIds.length, ticketEvents.map((e) => e.title).join(', '));
  console.log('  Pending invitation:', pendingId, inviteEvent.title);
  console.log('  Favorites:', ticketEvents.length, 'events + Sunset Productions');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
