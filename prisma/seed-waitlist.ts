import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientCtor } from '@prisma/client';
import { fileURLToPath } from 'node:url';

const WAITLIST_EVENT_TITLE = 'Concierto X';
const WAITLIST_EVENT_CITY = 'Santiago';
const FILLER_PHONE = '+56988888001';

function daysFromNow(days: number): Date {
  const result = new Date();
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function resolveSeedUser(prisma: PrismaClient) {
  return (
    (await prisma.user.findFirst({ where: { phone: '+56912345678' } })) ??
    (await prisma.user.findFirst({ where: { accountStatus: 'active' } }))
  );
}

export async function seedWaitlist(prisma: PrismaClient) {
  const guest = await resolveSeedUser(prisma);
  if (!guest) {
    console.log('Skipped waitlist seed — no active user');
    return;
  }

  const event = await prisma.event.findFirst({
    where: { title: WAITLIST_EVENT_TITLE, city: WAITLIST_EVENT_CITY, status: 'published' },
  });
  if (!event) {
    console.log(`Skipped waitlist seed — event not found: ${WAITLIST_EVENT_TITLE}`);
    return;
  }

  let producer = await prisma.producer.findFirst({ where: { name: 'El Tebo' } });
  if (!producer) {
    producer = await prisma.producer.create({ data: { name: 'El Tebo', logoUrl: null } });
  }

  let filler = await prisma.user.findFirst({ where: { phone: FILLER_PHONE } });
  if (!filler) {
    filler = await prisma.user.create({
      data: {
        phone: FILLER_PHONE,
        countryCode: 'CL',
        preferredLanguage: 'es',
        fullName: 'Waitlist Slot Filler',
        rutOrPassport: 'WL-FILL-01',
        email: 'waitlist-filler@youpass.test',
        birthdate: new Date('1992-06-15'),
        gender: 'other',
        termsAcceptedAt: new Date(),
        category: 'bronze',
        accountStatus: 'active',
      },
    });
  }

  await prisma.invitationSettings.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      enableWaitingList: true,
      enableManualReinvitation: true,
      allowGuaranteed: true,
      allowFree: true,
      allowDiscount: true,
      courtesySlotsTotal: 1,
      waitlistOfferHours: 4,
    },
    update: {
      enableWaitingList: true,
      courtesySlotsTotal: 1,
      waitlistOfferHours: 4,
    },
  });

  const existingFillerInvite = await prisma.invitation.findFirst({
    where: {
      eventId: event.id,
      recipientUserId: filler.id,
      type: 'guaranteed',
      source: 'producer',
    },
  });

  if (!existingFillerInvite) {
    await prisma.invitation.create({
      data: {
        eventId: event.id,
        producerId: producer.id,
        recipientUserId: filler.id,
        recipientPhone: filler.phone,
        recipientName: filler.fullName,
        type: 'guaranteed',
        tier: 'vip',
        status: 'sent',
        source: 'producer',
        assignedSlot: 'VIP Table — Seeded Full',
        entryValue: 65000,
        amountToPay: 0,
        chargeCurrency: event.currencyCode ?? 'CLP',
        cancellationDeadline: daysFromNow(10),
        sentAt: new Date(),
        expiresAt: daysFromNow(3),
      },
    });
  }

  const entry = await prisma.waitlistEntry.upsert({
    where: {
      eventId_userId: { eventId: event.id, userId: guest.id },
    },
    create: {
      eventId: event.id,
      userId: guest.id,
      status: 'waiting',
      joinedAt: new Date(),
    },
    update: {
      status: 'waiting',
      joinedAt: new Date(),
      leftAt: null,
      removedAt: null,
    },
  });

  console.log('Seeded waiting list demo:');
  console.log(`  Event: ${event.title} (${event.city})`);
  console.log(`  Guest on queue: ${guest.fullName} (${guest.phone})`);
  console.log(`  Queue entry id: ${entry.id}`);
  console.log(`  Courtesy slot held by: ${filler.fullName} (${filler.phone})`);
  console.log('  App: Drawer → My Invitations → Pending → WAITING LIST card');
  console.log('  App: Event detail → Concierto X → Leave waiting list');
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const prisma = new PrismaClientCtor();
  seedWaitlist(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
