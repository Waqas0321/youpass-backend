/**
 * Enable Party Mode for Invite Test Guest on all of their paid Chile tickets
 * so the Home toggle can auto-select among multiple live events.
 *
 * Run: npx tsx scripts/enable-party-mode-invite-guest.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/config/database.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

const PHONE = '+56988777123';
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
    categorySlug: 'gin',
    name: 'Tropical Gin',
    description: 'Gin with tropical mix',
    volumeMl: 350,
    priceClp: 6000,
    isRecommended: true,
    displayOrder: 3,
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
    categorySlug: 'piscolas',
    name: 'Cuba Libre',
    description: 'Rum, cola and lime',
    volumeMl: 350,
    priceClp: 4200,
    displayOrder: 2,
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
      is_recommended: 'isRecommended' in product ? product.isRecommended : false,
      display_order: product.displayOrder,
      status: 'available',
    });
    created += 1;
  }

  return { seeded: true as const, created };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const invitations = await prisma.invitation.findMany({
    where: {
      recipientUserId: user.id,
      ticket: { isNot: null },
    },
    include: { ticket: true, event: true },
    orderBy: { createdAt: 'asc' },
  });

  const paid = [];
  for (const invitation of invitations) {
    const slot = await prisma.ticketSlot.findFirst({
      where: { invitationId: invitation.id, order: { status: 'paid' } },
    });
    if (slot) {
      paid.push(invitation);
    }
  }

  if (paid.length === 0) {
    throw new Error('No paid tickets found for Invite Test Guest. Run seed-invite-test-guest.ts first.');
  }

  const now = new Date();
  const enabled = [];

  for (const [index, invitation] of paid.entries()) {
    const startsAt = new Date(now.getTime() + (index === 0 ? -60 : 90) * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);

    await prisma.event.update({
      where: { id: invitation.eventId },
      data: {
        startsAt,
        endsAt,
        status: 'published',
        latitude: SANTIAGO_LAT,
        longitude: SANTIAGO_LNG,
      },
    });

    await prisma.invitationTicket.update({
      where: { invitationId: invitation.id },
      data: {
        validatedAt: now,
        unlockAt: invitation.ticket?.unlockAt ?? now,
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'validated' },
    });

    const drinks = await seedDrinksIfNeeded(invitation.eventId);
    enabled.push({
      title: invitation.event.title,
      eventId: invitation.eventId,
      startsAt,
      endsAt,
      drinks,
    });
  }

  await ensureBypassUserId(user.id);

  const partyMode = await partyModeService.resolveForUser(user.id, {});

  console.log(
    JSON.stringify(
      {
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        events: enabled,
        party_mode: partyMode,
        next_steps: [
          'Hot restart the Flutter app and pull to refresh Home.',
          'Slide the Party Mode pill ON — it should open a drink menu.',
          'With multiple tickets, the live event is auto-selected by date/time.',
          'If using production API, add this user id to Vercel PARTY_MODE_BYPASS_USER_IDS and redeploy.',
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
