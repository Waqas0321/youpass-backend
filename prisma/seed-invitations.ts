import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import {
  eventDayStart,
  generateEntryCode,
  generateQrPayload,
} from '../src/modules/invitations/invitations.utils.js';
import { repairInvitationTimestamps } from '../src/modules/invitations/invitation-data-repair.service.js';

const INVITATION_EVENTS = [
  {
    title: 'YouFest 2026',
    venueName: 'Centro Eventos Hilaria',
    city: 'Concepción',
    countryCode: 'CL',
    startsAt: new Date('2026-07-04T22:00:00.000Z'),
    imageUrl: 'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
  },
  {
    title: 'Concierto X',
    venueName: 'Movistar Arena',
    city: 'Santiago',
    countryCode: 'CL',
    startsAt: new Date('2026-09-15T21:00:00.000Z'),
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
  },
  {
    title: 'Festival Verano 2026',
    venueName: 'Club Amanda',
    city: 'Santiago',
    countryCode: 'CL',
    startsAt: new Date('2026-05-15T22:00:00.000Z'),
    imageUrl: 'https://images.unsplash.com/photo-1459749411177-0410a7948c1a?w=800',
  },
];

const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  CL: 'America/Santiago',
  CO: 'America/Bogota',
  MX: 'America/Mexico_City',
  AR: 'America/Argentina/Buenos_Aires',
  PE: 'America/Lima',
};

function timezoneFor(countryCode: string): string {
  return TIMEZONE_BY_COUNTRY[countryCode] ?? 'UTC';
}

function expiresAtFromSentAt(sentAt: Date, expiryDays = 3): Date {
  const result = new Date(sentAt);
  result.setUTCDate(result.getUTCDate() + expiryDays);
  return result;
}

function hoursAgo(hours: number): Date {
  const result = new Date();
  result.setHours(result.getHours() - hours);
  return result;
}

function hoursFromNow(hours: number): Date {
  const result = new Date();
  result.setHours(result.getHours() + hours);
  return result;
}

/** Confirmed invitations on these events get a QR that is unlocked for local testing. */
const QR_AVAILABLE_EVENT_KEYS = [
  { title: 'Santiago Live Tonight', city: 'Santiago' },
  { title: 'VIP Lounge Experience', city: 'Santiago' },
  { title: 'Festival Verano 2026', city: 'Santiago' },
  { title: 'YouFest 2026', city: 'Concepción' },
  { title: 'Techno Warehouse', city: 'Santiago' },
  { title: 'Neon Disco CDMX', city: 'Ciudad de México' },
  { title: 'Caribe Night', city: 'Viña del Mar' },
] as const;

async function resolveInvitationSeedUser(prisma: PrismaClient) {
  const devUser =
    (await prisma.user.findFirst({
      where: {
        accountStatus: 'active',
        fullName: { contains: 'Dev T' },
      },
    })) ??
    (await prisma.user.findFirst({
      where: {
        accountStatus: 'active',
        fullName: { startsWith: 'Dev' },
      },
    }));

  if (devUser) {
    return devUser;
  }

  return prisma.user.findFirst({ where: { accountStatus: 'active' } });
}

function daysFromNow(days: number): Date {
  const result = new Date();
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function syncInvitationQrDemo(
  prisma: PrismaClient,
  recipientUserId: string,
  eventTitle: string,
  eventCity: string,
) {
  const event = await prisma.event.findFirst({
    where: { title: eventTitle, city: eventCity },
  });
  if (!event) {
    return;
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      eventId: event.id,
      recipientUserId,
      status: 'confirmed',
    },
  });
  if (!invitation) {
    return;
  }

  const startsAt = hoursFromNow(6);
  const unlockAt = hoursAgo(1);

  await prisma.event.update({
    where: { id: event.id },
    data: { startsAt },
  });

  const existing = await prisma.invitationTicket.findUnique({
    where: { invitationId: invitation.id },
  });

  if (existing) {
    const qrPayload = generateQrPayload(existing.id, event.id);
    await prisma.invitationTicket.update({
      where: { id: existing.id },
      data: { qrPayload, unlockAt },
    });
    return;
  }

  const ticketId = crypto.randomBytes(12).toString('hex');
  await prisma.invitationTicket.create({
    data: {
      id: ticketId,
      invitationId: invitation.id,
      manualEntryId: generateEntryCode(),
      qrPayload: generateQrPayload(ticketId, event.id),
      unlockAt,
    },
  });
}

async function syncQrAvailableInvitations(prisma: PrismaClient, recipientUserId: string) {
  for (const { title, city } of QR_AVAILABLE_EVENT_KEYS) {
    await syncInvitationQrDemo(prisma, recipientUserId, title, city);
  }
}

async function ensureTicket(
  prisma: PrismaClient,
  invitationId: string,
  eventId: string,
  startsAt: Date,
  countryCode: string,
) {
  const existing = await prisma.invitationTicket.findUnique({ where: { invitationId } });
  const unlockAt = eventDayStart(startsAt, timezoneFor(countryCode));

  if (existing) {
    const qrPayload = generateQrPayload(existing.id, eventId);
    if (existing.qrPayload !== qrPayload) {
      await prisma.invitationTicket.update({
        where: { id: existing.id },
        data: { qrPayload },
      });
    }
    return;
  }

  const ticketId = crypto.randomBytes(12).toString('hex');
  await prisma.invitationTicket.create({
    data: {
      id: ticketId,
      invitationId,
      manualEntryId: generateEntryCode(),
      qrPayload: generateQrPayload(ticketId, eventId),
      unlockAt,
    },
  });
}

async function fixAllQrPayloads(prisma: PrismaClient) {
  const tickets = await prisma.invitationTicket.findMany({
    include: { invitation: true },
  });

  for (const ticket of tickets) {
    const expected = generateQrPayload(ticket.id, ticket.invitation.eventId);
    if (ticket.qrPayload !== expected) {
      await prisma.invitationTicket.update({
        where: { id: ticket.id },
        data: { qrPayload: expected },
      });
    }
  }
}

export async function seedInvitations(prisma: PrismaClient) {
  const repaired = await repairInvitationTimestamps(prisma);
  if (repaired > 0) {
    console.log(`Repaired ${repaired} invitation timestamp(s)`);
  }

  const user = await resolveInvitationSeedUser(prisma);
  if (!user) {
    console.log('Skipped invitations seed — no active user');
    return;
  }

  console.log(`Seeding invitations for ${user.fullName} (${user.phone})`);

  const eventType = await prisma.eventType.findFirst({ where: { slug: 'concerts' } });
  if (!eventType) {
    console.log('Skipped invitations seed — no event types');
    return;
  }

  let producerTebo = await prisma.producer.findFirst({ where: { name: 'El Tebo' } });
  if (!producerTebo) {
    producerTebo = await prisma.producer.create({ data: { name: 'El Tebo', logoUrl: null } });
  }

  let producerSunset = await prisma.producer.findFirst({ where: { name: 'Sunset Productions' } });
  if (!producerSunset) {
    producerSunset = await prisma.producer.create({
      data: { name: 'Sunset Productions', logoUrl: null },
    });
  }

  const eventIds: string[] = [];
  for (const evt of INVITATION_EVENTS) {
    const existing = await prisma.event.findFirst({
      where: { title: evt.title, city: evt.city },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          venueName: evt.venueName,
          startsAt: evt.startsAt,
          imageUrl: evt.imageUrl,
          countryCode: evt.countryCode,
          status: 'published',
        },
      });
      eventIds.push(existing.id);
    } else {
      const created = await prisma.event.create({
        data: {
          title: evt.title,
          venueName: evt.venueName,
          city: evt.city,
          countryCode: evt.countryCode,
          startsAt: evt.startsAt,
          imageUrl: evt.imageUrl,
          eventTypeId: eventType.id,
          status: 'published',
          isFeatured: false,
        },
      });
      eventIds.push(created.id);
    }
  }

  const [youfestId, conciertoId, festivalId] = eventIds;

  const upsertInvitation = async (
    key: { eventId: string; type: string; recipientUserId: string },
    data: Parameters<typeof prisma.invitation.create>[0]['data'],
  ) => {
    const existing = await prisma.invitation.findFirst({
      where: {
        eventId: key.eventId,
        type: key.type as never,
        recipientUserId: key.recipientUserId,
      },
    });

    if (existing) {
      return prisma.invitation.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          tier: data.tier,
          assignedSlot: data.assignedSlot,
          customMessage: data.customMessage,
          chargeAmount: data.chargeAmount,
          chargeCurrency: data.chargeCurrency,
          discountPercent: data.discountPercent,
          requiresPaymentMethod: data.requiresPaymentMethod,
          termsAcceptedRequired: data.termsAcceptedRequired,
          cancellationDeadline: data.cancellationDeadline,
          respondedAt: data.respondedAt,
          sentAt: data.sentAt,
          expiresAt:
            data.expiresAt ??
            (data.sentAt ? expiresAtFromSentAt(data.sentAt as Date) : undefined),
        },
      });
    }

    const sentAt = (data.sentAt as Date | undefined) ?? new Date();
    return prisma.invitation.create({
      data: {
        ...data,
        sentAt,
        expiresAt: data.expiresAt ?? expiresAtFromSentAt(sentAt),
      },
    });
  };

  const pendingCourtesy = await upsertInvitation(
    { eventId: youfestId!, type: 'courtesy', recipientUserId: user.id },
    {
      eventId: youfestId!,
      producerId: producerTebo.id,
      recipientUserId: user.id,
      type: 'courtesy',
      tier: 'vip',
      status: 'pending',
      assignedSlot: 'VIP Table 1',
      customMessage: 'Guaranteed VIP pass — 100% free if you attend.',
      chargeAmount: 48000,
      chargeCurrency: 'CLP',
      requiresPaymentMethod: true,
      termsAcceptedRequired: true,
      cancellationDeadline: daysFromNow(14),
      sentAt: hoursAgo(2),
    },
  );

  const pendingFree = await upsertInvitation(
    { eventId: conciertoId!, type: 'free', recipientUserId: user.id },
    {
      eventId: conciertoId!,
      producerId: producerTebo.id,
      recipientUserId: user.id,
      type: 'free',
      tier: 'general',
      status: 'pending',
      requiresPaymentMethod: false,
      customMessage: 'Free invitation — no commitment required.',
      cancellationDeadline: daysFromNow(10),
      sentAt: hoursAgo(5),
    },
  );

  const confirmedFree = await upsertInvitation(
    { eventId: festivalId!, type: 'vip', recipientUserId: user.id },
    {
      eventId: festivalId!,
      producerId: producerSunset.id,
      recipientUserId: user.id,
      type: 'vip',
      tier: 'vip',
      status: 'confirmed',
      assignedSlot: 'VIP General',
      requiresPaymentMethod: false,
      respondedAt: new Date('2026-05-28T14:22:00.000Z'),
      sentAt: new Date('2026-05-20T12:00:00.000Z'),
    },
  );

  const festivalEvent = await prisma.event.findUniqueOrThrow({ where: { id: festivalId! } });
  await ensureTicket(
    prisma,
    confirmedFree.id,
    festivalId!,
    festivalEvent.startsAt,
    festivalEvent.countryCode,
  );

  // Extra invitations for richer test data
  const technoEvent = await prisma.event.findFirst({
    where: { title: 'Techno Warehouse', city: 'Santiago' },
  });
  const vipLoungeEvent = await prisma.event.findFirst({
    where: { title: 'VIP Lounge Experience', city: 'Santiago' },
  });
  const neonDiscoEvent = await prisma.event.findFirst({
    where: { title: 'Neon Disco CDMX', city: 'Ciudad de México' },
  });

  if (technoEvent) {
    const pendingDiscounted = await upsertInvitation(
      { eventId: technoEvent.id, type: 'discounted', recipientUserId: user.id },
      {
        eventId: technoEvent.id,
        producerId: producerTebo.id,
        recipientUserId: user.id,
        type: 'discounted',
        tier: 'general',
        status: 'pending',
        chargeAmount: 15000,
        chargeCurrency: 'CLP',
        discountPercent: 50,
        requiresPaymentMethod: true,
        customMessage: '50% off — pay now to secure your spot.',
        cancellationDeadline: daysFromNow(12),
        sentAt: hoursAgo(1),
      },
    );

    const technoConfirmed = await upsertInvitation(
      { eventId: technoEvent.id, type: 'general', recipientUserId: user.id },
      {
        eventId: technoEvent.id,
        producerId: producerTebo.id,
        recipientUserId: user.id,
        type: 'general',
        tier: 'general',
        status: 'confirmed',
        requiresPaymentMethod: false,
        respondedAt: hoursAgo(2),
        sentAt: hoursAgo(24),
      },
    );
    await ensureTicket(
      prisma,
      technoConfirmed.id,
      technoEvent.id,
      technoEvent.startsAt,
      technoEvent.countryCode,
    );
  }

  if (vipLoungeEvent) {
    const confirmedGuaranteed = await upsertInvitation(
      { eventId: vipLoungeEvent.id, type: 'courtesy', recipientUserId: user.id },
      {
        eventId: vipLoungeEvent.id,
        producerId: producerSunset.id,
        recipientUserId: user.id,
        type: 'courtesy',
        tier: 'vip',
        status: 'confirmed',
        assignedSlot: 'VIP Lounge A',
        chargeAmount: 65000,
        chargeCurrency: 'CLP',
        requiresPaymentMethod: true,
        termsAcceptedRequired: true,
        customMessage: 'Confirmed Guaranteed Pass — attended commitment accepted.',
        respondedAt: hoursAgo(4),
        sentAt: hoursAgo(48),
      },
    );
    await ensureTicket(
      prisma,
      confirmedGuaranteed.id,
      vipLoungeEvent.id,
      vipLoungeEvent.startsAt,
      vipLoungeEvent.countryCode,
    );
  }

  const caribeEvent = await prisma.event.findFirst({
    where: { title: 'Caribe Night', city: 'Viña del Mar' },
  });

  if (caribeEvent) {
    const confirmedDiscounted = await upsertInvitation(
      { eventId: caribeEvent.id, type: 'discounted', recipientUserId: user.id },
      {
        eventId: caribeEvent.id,
        producerId: producerSunset.id,
        recipientUserId: user.id,
        type: 'discounted',
        tier: 'general',
        status: 'confirmed',
        chargeAmount: 12000,
        chargeCurrency: 'CLP',
        discountPercent: 50,
        requiresPaymentMethod: true,
        customMessage: 'Confirmed discounted invitation — 50% paid.',
        respondedAt: hoursAgo(6),
        sentAt: hoursAgo(72),
      },
    );
    await ensureTicket(
      prisma,
      confirmedDiscounted.id,
      caribeEvent.id,
      caribeEvent.startsAt,
      caribeEvent.countryCode,
    );
  }

  if (neonDiscoEvent) {
    const neonConfirmed = await upsertInvitation(
      { eventId: neonDiscoEvent.id, type: 'free', recipientUserId: user.id },
      {
        eventId: neonDiscoEvent.id,
        producerId: producerSunset.id,
        recipientUserId: user.id,
        type: 'free',
        tier: 'general',
        status: 'confirmed',
        requiresPaymentMethod: false,
        respondedAt: hoursAgo(3),
        sentAt: hoursAgo(48),
      },
    );
    await ensureTicket(
      prisma,
      neonConfirmed.id,
      neonDiscoEvent.id,
      neonDiscoEvent.startsAt,
      neonDiscoEvent.countryCode,
    );
  }

  const santiagoTonightEvent = await prisma.event.findFirst({
    where: { title: 'Santiago Live Tonight', city: 'Santiago' },
  });

  if (santiagoTonightEvent) {
    const tonightConfirmed = await upsertInvitation(
      { eventId: santiagoTonightEvent.id, type: 'vip', recipientUserId: user.id },
      {
        eventId: santiagoTonightEvent.id,
        producerId: producerTebo.id,
        recipientUserId: user.id,
        type: 'vip',
        tier: 'vip',
        status: 'confirmed',
        assignedSlot: 'VIP Floor',
        requiresPaymentMethod: false,
        respondedAt: new Date('2026-06-03T10:00:00.000Z'),
        sentAt: new Date('2026-06-02T12:00:00.000Z'),
      },
    );
    await ensureTicket(
      prisma,
      tonightConfirmed.id,
      santiagoTonightEvent.id,
      santiagoTonightEvent.startsAt,
      santiagoTonightEvent.countryCode,
    );
  }

  // Fix any confirmed invitations that have invalid/missing tickets (e.g. after JWT_SECRET change)
  const confirmedInvitations = await prisma.invitation.findMany({
    where: { recipientUserId: user.id, status: 'confirmed' },
    include: { event: true },
  });

  for (const inv of confirmedInvitations) {
    await ensureTicket(
      prisma,
      inv.id,
      inv.eventId,
      inv.event.startsAt,
      inv.event.countryCode,
    );
  }

  await fixAllQrPayloads(prisma);
  await syncQrAvailableInvitations(prisma, user.id);

  const total = await prisma.invitation.count({ where: { recipientUserId: user.id } });
  console.log(`Seeded ${total} invitations for user ${user.fullName} (${user.phone})`);
  console.log('  Section 14.1 test matrix:');
  console.log('    PENDING  Free (green)       → Concierto X');
  console.log('    PENDING  Guaranteed (gold)   → YouFest 2026');
  console.log('    PENDING  Discounted (purple) → Techno Warehouse');
  console.log('    CONFIRMED Free (green)       → Festival Verano 2026, Neon Disco CDMX');
  console.log('    CONFIRMED Guaranteed (gold)  → VIP Lounge Experience');
  console.log('    CONFIRMED Discounted (purple)→ Caribe Night');
  console.log(`    Pending courtesy id: ${pendingCourtesy.id}`);
  console.log(`    Pending free id: ${pendingFree.id}`);
  if (technoEvent) {
    console.log('    Pending discounted → Techno Warehouse');
  }
  console.log(
    `  QR unlocked for: ${QR_AVAILABLE_EVENT_KEYS.map((e) => e.title).join(', ')}`,
  );
}
