/**
 * One-shot dummy data patch — fixes event images, invitation QR payloads,
 * and adds more sample events + invitations. Safe to re-run (upserts / idempotent fixes).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import {
  eventDayStart,
  generateEntryCode,
  generateQrPayload,
} from '../src/modules/invitations/invitations.utils.js';

const prisma = new PrismaClient();

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  'https://images.unsplash.com/photo-1459749411177-0410a7948c1a?w=800',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
  'https://images.unsplash.com/photo-1415201364774-f6f0ff35aa28?w=800',
  'https://images.unsplash.com/photo-1571266028243-e4733b2d325c?w=800',
  'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d87?w=800',
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
  'https://images.unsplash.com/photo-1429962710811-db857818a988?w=800',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
];

const EXTRA_EVENTS = [
  {
    title: 'Salsa Night Lima',
    description: 'Live salsa bands and dance floor all night.',
    startsAt: new Date('2026-08-22T23:00:00.000Z'),
    venueName: 'La Noche Club',
    city: 'Lima',
    countryCode: 'PE',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
    eventTypeSlug: 'parties',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Neon Disco CDMX',
    description: 'Retro-futuristic disco experience in Roma Norte.',
    startsAt: new Date('2026-09-05T02:00:00.000Z'),
    venueName: 'Palmares Rooftop',
    city: 'Ciudad de México',
    countryCode: 'MX',
    imageUrl: 'https://images.unsplash.com/photo-1571266028243-e4733b2d325c?w=800',
    eventTypeSlug: 'parties',
    isFeatured: true,
    featuredOrder: 4,
  },
  {
    title: 'Bachata Social BA',
    description: 'Open social with top DJs from Buenos Aires.',
    startsAt: new Date('2026-08-30T22:30:00.000Z'),
    venueName: 'Club Niceto',
    city: 'Buenos Aires',
    countryCode: 'AR',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    eventTypeSlug: 'parties',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Rooftop Vibes Medellín',
    description: 'Sunset cocktails and house music with city views.',
    startsAt: new Date('2026-10-12T21:00:00.000Z'),
    venueName: 'Envy Rooftop',
    city: 'Medellín',
    countryCode: 'CO',
    imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d87?w=800',
    eventTypeSlug: 'bar',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Pool Party Cartagena',
    description: 'Beach club pool party with international DJs.',
    startsAt: new Date('2026-11-28T18:00:00.000Z'),
    venueName: 'Cafe del Mar',
    city: 'Cartagena',
    countryCode: 'CO',
    imageUrl: 'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
    eventTypeSlug: 'parties',
    isFeatured: true,
    featuredOrder: 5,
  },
  {
    title: 'Acoustic Sessions PK',
    description: 'Intimate acoustic sets in Islamabad.',
    startsAt: new Date('2026-12-06T17:00:00.000Z'),
    venueName: 'The Hive',
    city: 'Islamabad',
    countryCode: 'PK',
    imageUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0ff35aa28?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Techno Warehouse',
    description: 'Underground techno until sunrise.',
    startsAt: new Date('2026-06-10T23:00:00.000Z'),
    venueName: 'Fabrica B',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'VIP Lounge Experience',
    description: 'Exclusive lounge night with live DJ and premium bar.',
    startsAt: new Date('2026-06-05T21:00:00.000Z'),
    venueName: 'Sky Bar',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1429962710811-db857818a988?w=800',
    eventTypeSlug: 'bar',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Santiago Live Tonight',
    description: 'Live music tonight — QR unlocks on event day.',
    startsAt: new Date('2026-06-04T00:00:00.000Z'),
    venueName: 'Teatro Coliseo',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
];

type ExtraInvitation = {
  eventTitle: string;
  eventCity: string;
  producerName: string;
  type: 'courtesy' | 'free' | 'general' | 'vip' | 'vip_table' | 'discounted';
  tier: 'general' | 'vip';
  status: 'pending' | 'confirmed' | 'rejected';
  assignedSlot?: string;
  customMessage?: string;
  chargeAmount?: number;
  requiresPaymentMethod?: boolean;
  termsAcceptedRequired?: boolean;
  cancellationDeadline?: Date;
  sentAt: Date;
  respondedAt?: Date;
};

const EXTRA_INVITATIONS: ExtraInvitation[] = [
  {
    eventTitle: 'Techno Warehouse',
    eventCity: 'Santiago',
    producerName: 'El Tebo',
    type: 'general',
    tier: 'general',
    status: 'pending',
    sentAt: new Date('2026-06-01T09:00:00.000Z'),
  },
  {
    eventTitle: 'VIP Lounge Experience',
    eventCity: 'Santiago',
    producerName: 'Sunset Productions',
    type: 'vip',
    tier: 'vip',
    status: 'confirmed',
    assignedSlot: 'VIP Lounge A',
    sentAt: new Date('2026-05-25T14:00:00.000Z'),
    respondedAt: new Date('2026-05-26T11:30:00.000Z'),
  },
  {
    eventTitle: 'Neon Disco CDMX',
    eventCity: 'Ciudad de México',
    producerName: 'Sunset Productions',
    type: 'free',
    tier: 'general',
    status: 'pending',
    sentAt: new Date('2026-06-02T16:00:00.000Z'),
  },
  {
    eventTitle: 'Pool Party Cartagena',
    eventCity: 'Cartagena',
    producerName: 'El Tebo',
    type: 'courtesy',
    tier: 'vip',
    status: 'pending',
    assignedSlot: 'VIP Cabana 3',
    customMessage: 'Complimentary VIP access — confirm to reserve your spot.',
    chargeAmount: 35000,
    requiresPaymentMethod: true,
    termsAcceptedRequired: true,
    cancellationDeadline: new Date('2026-11-20T23:59:59.000Z'),
    sentAt: new Date('2026-06-03T08:00:00.000Z'),
  },
  {
    eventTitle: 'Salsa Night Lima',
    eventCity: 'Lima',
    producerName: 'El Tebo',
    type: 'discounted',
    tier: 'general',
    status: 'rejected',
    sentAt: new Date('2026-05-10T12:00:00.000Z'),
    respondedAt: new Date('2026-05-11T09:00:00.000Z'),
  },
  {
    eventTitle: 'URBAN NIGHT LIVE',
    eventCity: 'Santiago',
    producerName: 'Sunset Productions',
    type: 'vip_table',
    tier: 'vip',
    status: 'confirmed',
    assignedSlot: 'Table 7',
    sentAt: new Date('2026-05-15T10:00:00.000Z'),
    respondedAt: new Date('2026-05-16T18:00:00.000Z'),
  },
  {
    eventTitle: 'Santiago Live Tonight',
    eventCity: 'Santiago',
    producerName: 'El Tebo',
    type: 'vip',
    tier: 'vip',
    status: 'confirmed',
    assignedSlot: 'VIP Floor',
    sentAt: new Date('2026-06-02T12:00:00.000Z'),
    respondedAt: new Date('2026-06-03T10:00:00.000Z'),
  },
];

async function ensureEventImages() {
  const events = await prisma.event.findMany({ orderBy: { createdAt: 'asc' } });
  let fixed = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (!event.imageUrl) {
      await prisma.event.update({
        where: { id: event.id },
        data: { imageUrl: FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]! },
      });
      fixed++;
    }
  }

  console.log(`Event images: ${events.length} total, ${fixed} fixed (missing → assigned)`);
}

async function fixAllQrPayloads() {
  const tickets = await prisma.invitationTicket.findMany({
    include: { invitation: { include: { event: true } } },
  });

  let fixed = 0;
  for (const ticket of tickets) {
    const expected = generateQrPayload(ticket.id, ticket.invitation.eventId);
    if (ticket.qrPayload !== expected) {
      await prisma.invitationTicket.update({
        where: { id: ticket.id },
        data: { qrPayload: expected },
      });
      fixed++;
      console.log(`  Fixed QR for ticket ${ticket.id.slice(-8)} (${ticket.invitation.event.title})`);
    }
  }

  console.log(`QR payloads: ${tickets.length} tickets, ${fixed} corrected`);
}

async function ensureConfirmedTickets() {
  const confirmed = await prisma.invitation.findMany({
    where: { status: 'confirmed' },
    include: { ticket: true, event: true },
  });

  let created = 0;
  for (const inv of confirmed) {
    if (inv.ticket) continue;

    const timezone =
      inv.event.countryCode === 'CL'
        ? 'America/Santiago'
        : inv.event.countryCode === 'CO'
          ? 'America/Bogota'
          : inv.event.countryCode === 'MX'
            ? 'America/Mexico_City'
            : 'UTC';

    const ticketId = crypto.randomBytes(12).toString('hex');
    const qrPayload = generateQrPayload(ticketId, inv.eventId);
    const unlockAt = eventDayStart(inv.event.startsAt, timezone);

    await prisma.invitationTicket.create({
      data: {
        id: ticketId,
        invitationId: inv.id,
        manualEntryId: generateEntryCode(),
        qrPayload,
        unlockAt,
      },
    });
    created++;
    console.log(`  Created ticket for confirmed invitation → ${inv.event.title}`);
  }

  console.log(`Confirmed tickets: ${confirmed.length} confirmed, ${created} new tickets created`);
}

async function upsertExtraEvents() {
  const types = await prisma.eventType.findMany();
  const typeBySlug = new Map(types.map((t) => [t.slug, t.id]));
  let created = 0;
  let updated = 0;

  for (const event of EXTRA_EVENTS) {
    const eventTypeId = typeBySlug.get(event.eventTypeSlug);
    if (!eventTypeId) continue;

    const existing = await prisma.event.findFirst({
      where: { title: event.title, city: event.city },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          description: event.description,
          startsAt: event.startsAt,
          venueName: event.venueName,
          countryCode: event.countryCode,
          imageUrl: event.imageUrl,
          eventTypeId,
          isFeatured: event.isFeatured,
          featuredOrder: event.featuredOrder,
          status: 'published',
        },
      });
      updated++;
    } else {
      await prisma.event.create({
        data: {
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          venueName: event.venueName,
          city: event.city,
          countryCode: event.countryCode,
          imageUrl: event.imageUrl,
          eventTypeId,
          isFeatured: event.isFeatured,
          featuredOrder: event.featuredOrder,
          status: 'published',
        },
      });
      created++;
    }
  }

  console.log(`Extra events: ${created} created, ${updated} updated`);
}

async function addExtraInvitations() {
  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  if (!user) {
    console.log('Skipped extra invitations — no active user');
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const inv of EXTRA_INVITATIONS) {
    const event = await prisma.event.findFirst({
      where: { title: inv.eventTitle, city: inv.eventCity },
    });
    if (!event) {
      console.log(`  Skipped invitation — event not found: ${inv.eventTitle}`);
      continue;
    }

    let producer = await prisma.producer.findFirst({ where: { name: inv.producerName } });
    if (!producer) {
      producer = await prisma.producer.create({ data: { name: inv.producerName, logoUrl: null } });
    }

    const exists = await prisma.invitation.findFirst({
      where: {
        recipientUserId: user.id,
        eventId: event.id,
        type: inv.type,
        status: inv.status,
      },
    });

    if (exists) {
      skipped++;
      continue;
    }

    const created = await prisma.invitation.create({
      data: {
        eventId: event.id,
        producerId: producer.id,
        recipientUserId: user.id,
        type: inv.type,
        tier: inv.tier,
        status: inv.status,
        assignedSlot: inv.assignedSlot,
        customMessage: inv.customMessage,
        chargeAmount: inv.chargeAmount,
        chargeCurrency: inv.chargeAmount ? 'CLP' : undefined,
        requiresPaymentMethod: inv.requiresPaymentMethod ?? false,
        termsAcceptedRequired: inv.termsAcceptedRequired ?? false,
        cancellationDeadline: inv.cancellationDeadline,
        sentAt: inv.sentAt,
        respondedAt: inv.respondedAt,
      },
      include: { event: true },
    });

    if (inv.status === 'confirmed') {
      const timezone =
        event.countryCode === 'CL'
          ? 'America/Santiago'
          : event.countryCode === 'CO'
            ? 'America/Bogota'
            : event.countryCode === 'MX'
              ? 'America/Mexico_City'
              : 'UTC';

      const ticketId = crypto.randomBytes(12).toString('hex');
      await prisma.invitationTicket.create({
        data: {
          id: ticketId,
          invitationId: created.id,
          manualEntryId: generateEntryCode(),
          qrPayload: generateQrPayload(ticketId, event.id),
          unlockAt: eventDayStart(event.startsAt, timezone),
        },
      });
    }

    added++;
    console.log(`  Added invitation: ${inv.status} ${inv.type} → ${event.title}`);
  }

  console.log(`Extra invitations: ${added} added, ${skipped} already existed`);
}

/** Mark past confirmed tickets as validated with entry/consumption/stay stats for Past tab UI. */
async function seedPastValidatedTickets() {
  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  if (!user) return;

  const pastValidated = [
    {
      eventTitle: 'Festival Verano 2026',
      eventCity: 'Santiago',
      entryOffsetMinutes: 41,
      consumptionCount: 6,
      stayMinutes: 314,
    },
  ];

  for (const item of pastValidated) {
    const event = await prisma.event.findFirst({
      where: { title: item.eventTitle, city: item.eventCity },
    });
    if (!event) continue;

    const invitation = await prisma.invitation.findFirst({
      where: {
        recipientUserId: user.id,
        eventId: event.id,
        status: { in: ['confirmed', 'validated'] },
      },
      include: { ticket: true },
    });
    if (!invitation?.ticket) continue;

    const validatedAt = new Date(event.startsAt.getTime() + item.entryOffsetMinutes * 60_000);

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'validated' },
    });

    await prisma.invitationTicket.update({
      where: { id: invitation.ticket.id },
      data: {
        validatedAt,
        consumptionCount: item.consumptionCount,
        stayMinutes: item.stayMinutes,
      },
    });

    console.log(`  Past validated ticket: ${item.eventTitle} (entry +${item.entryOffsetMinutes}m)`);
  }
}

async function main() {
  console.log('Patching dummy data...\n');

  await ensureEventImages();
  await upsertExtraEvents();
  await ensureConfirmedTickets();
  await fixAllQrPayloads();
  await addExtraInvitations();
  await fixAllQrPayloads();
  await seedPastValidatedTickets();

  const [eventCount, invitationCount, ticketCount] = await Promise.all([
    prisma.event.count(),
    prisma.invitation.count(),
    prisma.invitationTicket.count(),
  ]);

  console.log(`\nDone — ${eventCount} events, ${invitationCount} invitations, ${ticketCount} tickets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
