import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

const PHONE = '+923205905162';

const DRINK_IMAGES_BY_NAME: Record<string, string> = {
  Piscola:
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=640&q=80',
  'Cuba Libre':
    'https://images.unsplash.com/photo-1551024709-8f03bef6176a?auto=format&fit=crop&w=640&q=80',
  'Tropical Gin':
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d46?auto=format&fit=crop&w=640&q=80',
  Corona:
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=640&q=80',
  'Jager Bomb':
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=640&q=80',
  'Chandon Brut':
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=640&q=80',
  'Mineral Water':
    'https://images.unsplash.com/photo-1548839140-29a7492991a9?auto=format&fit=crop&w=640&q=80',
};

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
    categorySlug: 'piscolas',
    name: 'Cuba Libre',
    description: 'Rum, cola and lime',
    volumeMl: 350,
    priceClp: 4200,
    displayOrder: 2,
  },
  {
    categorySlug: 'gin',
    name: 'Tropical Gin',
    description: 'Gin with tropical mix',
    volumeMl: 350,
    priceClp: 6000,
    isRecommended: true,
    displayOrder: 3,
  },
  {
    categorySlug: 'cervezas',
    name: 'Corona',
    description: 'Imported lager',
    volumeMl: 330,
    priceClp: 3500,
    displayOrder: 4,
  },
  {
    categorySlug: 'energeticas',
    name: 'Jager Bomb',
    description: 'Jägermeister with energy drink',
    volumeMl: 250,
    priceClp: 8000,
    isRecommended: true,
    displayOrder: 5,
  },
  {
    categorySlug: 'espumantes',
    name: 'Chandon Brut',
    description: 'Sparkling wine bottle',
    volumeMl: 750,
    priceClp: 12000,
    displayOrder: 6,
  },
  {
    categorySlug: 'agua-bebidas',
    name: 'Mineral Water',
    description: 'Still water 500ml',
    volumeMl: 500,
    priceClp: 1500,
    displayOrder: 7,
  },
] as const;

/** Prefer one live event per day for the next week (TestA ticketed events). */
const DAY_EVENT_TITLES = [
  'Lahore Beats Festival',
  'Community Open Mic Night',
  'Karachi Rooftop Sessions',
  'EDM Night Karachi',
  'Qawwali & Chill',
  'Food Truck Fiesta',
  'Comedy & Cocktails',
] as const;

function startOfLocalDay(base: Date, dayOffset: number): Date {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
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
      image_url: DRINK_IMAGES_BY_NAME[product.name] ?? null,
      is_recommended: product.isRecommended ?? false,
      display_order: product.displayOrder,
      status: 'available',
    });
    created += 1;
  }

  return { seeded: true as const, created };
}

async function ensureValidatedTicket(userId: string, eventId: string, now: Date) {
  const invitation = await prisma.invitation.findFirst({
    where: { recipientUserId: userId, eventId },
    include: { ticket: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!invitation) {
    return { ok: false as const, reason: 'no_invitation' };
  }

  const paidSlot = await prisma.ticketSlot.findFirst({
    where: {
      invitationId: invitation.id,
      order: { status: 'paid' },
    },
  });

  if (!paidSlot) {
    return { ok: false as const, reason: 'no_paid_slot' };
  }

  await prisma.$transaction(async (tx) => {
    if (invitation.ticket) {
      await tx.invitationTicket.update({
        where: { invitationId: invitation.id },
        data: { validatedAt: invitation.ticket.validatedAt ?? now },
      });
    }

    if (invitation.status !== 'validated') {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'validated' },
      });
    }
  });

  return { ok: true as const };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const now = new Date();
  const results = [];

  for (let dayOffset = 0; dayOffset < DAY_EVENT_TITLES.length; dayOffset += 1) {
    const title = DAY_EVENT_TITLES[dayOffset];
    const event = await prisma.event.findFirst({ where: { title } });
    if (!event) {
      results.push({ title, skipped: true, reason: 'event_not_found' });
      continue;
    }

    const day = startOfLocalDay(now, dayOffset);
    // Live window: doors ~19:00 local, ends ~03:00 next day.
    const startsAt = new Date(day);
    startsAt.setHours(19, 0, 0, 0);
    const endsAt = new Date(day);
    endsAt.setDate(endsAt.getDate() + 1);
    endsAt.setHours(3, 0, 0, 0);

    // Keep "today" already in progress so Party Mode is live immediately.
    if (dayOffset === 0) {
      startsAt.setTime(now.getTime() - 60 * 60 * 1000);
      endsAt.setTime(now.getTime() + 8 * 60 * 60 * 1000);
    }

    await prisma.event.update({
      where: { id: event.id },
      data: {
        startsAt,
        endsAt,
        status: 'published',
      },
    });

    const ticket = await ensureValidatedTicket(user.id, event.id, now);
    const drinks = await seedDrinksIfNeeded(event.id);

    results.push({
      dayOffset,
      title,
      eventId: event.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      ticket,
      drinks,
    });
  }

  const partyMode = await partyModeService.resolveForUser(user.id, {});

  console.log(
    JSON.stringify(
      {
        now: now.toISOString(),
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        activated: results,
        party_mode: partyMode,
        next_steps: [
          'Pull to refresh Home (or hot restart the app).',
          'Party Mode should resolve to today\'s live event with a drink menu.',
          'Each of the next 6 days has another ticketed event made live.',
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
