import { PrismaClient } from '@prisma/client';
import { generateQrPayload, eventDayStart } from '../src/modules/invitations/invitations.utils.js';
import crypto from 'node:crypto';

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

export async function seedInvitations(prisma: PrismaClient) {
  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  if (!user) {
    console.log('Skipped invitations seed — no active user');
    return;
  }

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

  await prisma.invitationTicket.deleteMany({
    where: { invitation: { recipientUserId: user.id } },
  });
  await prisma.invitation.deleteMany({ where: { recipientUserId: user.id } });

  const pendingCourtesy = await prisma.invitation.create({
    data: {
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
      cancellationDeadline: new Date('2026-07-01T23:59:59.000Z'),
      sentAt: new Date('2026-06-01T18:30:00.000Z'),
    },
  });

  await prisma.invitation.create({
    data: {
      eventId: conciertoId!,
      producerId: producerTebo.id,
      recipientUserId: user.id,
      type: 'general',
      tier: 'general',
      status: 'pending',
      requiresPaymentMethod: false,
      sentAt: new Date('2026-06-02T10:00:00.000Z'),
    },
  });

  const confirmed = await prisma.invitation.create({
    data: {
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
  });

  const festivalEvent = await prisma.event.findUniqueOrThrow({ where: { id: festivalId! } });
  const ticketId = crypto.randomBytes(12).toString('hex');
  const entryCode = '8F7A2B';
  const qrPayload = generateQrPayload(ticketId, festivalId!);
  const unlockAt = eventDayStart(festivalEvent.startsAt, 'America/Santiago');

  await prisma.invitationTicket.create({
    data: {
      id: ticketId,
      invitationId: confirmed.id,
      manualEntryId: entryCode,
      qrPayload,
      unlockAt,
    },
  });

  console.log(`Seeded 3 invitations for user ${user.fullName} (${user.phone})`);
  console.log(`  Pending courtesy: ${pendingCourtesy.id}`);
  console.log(`  Confirmed VIP: ${confirmed.id}`);
}
