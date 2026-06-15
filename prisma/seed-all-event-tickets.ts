/**
 * Backfills ticket offerings (including VIP General) for published upcoming events.
 * Safe to re-run — upserts by eventId + type.
 *
 * Run: npm run db:seed:tickets
 */
import 'dotenv/config';
import { PrismaClient, type TicketOfferingType } from '@prisma/client';

const prisma = new PrismaClient();

type OfferingWave = {
  type: TicketOfferingType;
  name: string;
  multiplier: number;
  displayOrder: number;
  stockTotal: number | null;
};

const OFFERING_WAVES: OfferingWave[] = [
  { type: 'early_bird', name: 'Early Bird', multiplier: 1, displayOrder: 1, stockTotal: 80 },
  { type: 'preventa_2', name: 'Pre-sale 2nd wave', multiplier: 1.2, displayOrder: 2, stockTotal: 150 },
  { type: 'preventa_3', name: 'Pre-sale 3rd wave', multiplier: 1.4, displayOrder: 3, stockTotal: null },
  { type: 'general', name: 'General', multiplier: 1.6, displayOrder: 4, stockTotal: null },
  { type: 'vip_general', name: 'VIP General', multiplier: 2.5, displayOrder: 5, stockTotal: null },
];

const DEFAULT_BASE_PRICES: Record<string, number> = {
  CL: 25000,
  CO: 80000,
  MX: 500,
  PE: 60,
  AR: 15000,
  PK: 2500,
  DEFAULT: 10000,
};

function resolveBasePrice(countryCode: string, minPrice: number | null) {
  if (minPrice != null && minPrice > 0) {
    return minPrice;
  }
  return DEFAULT_BASE_PRICES[countryCode] ?? DEFAULT_BASE_PRICES.DEFAULT;
}

async function seedOfferingsForEvent(
  eventId: string,
  countryCode: string,
  basePrice: number,
  onlyTypes?: TicketOfferingType[],
) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const currency =
    country?.currencyCode ??
    (countryCode === 'PK' ? 'PKR' : countryCode === 'CL' ? 'CLP' : 'USD');

  const waves = onlyTypes
    ? OFFERING_WAVES.filter((wave) => onlyTypes.includes(wave.type))
    : OFFERING_WAVES;

  for (const wave of waves) {
    const price = Math.round(basePrice * wave.multiplier);
    await prisma.eventTicketOffering.upsert({
      where: { eventId_type: { eventId, type: wave.type } },
      create: {
        eventId,
        type: wave.type,
        name: wave.name,
        price,
        displayOrder: wave.displayOrder,
        currency,
        stockTotal: wave.stockTotal,
        stockRemaining: wave.stockTotal,
        status: 'active',
      },
      update: {
        name: wave.name,
        price,
        displayOrder: wave.displayOrder,
        currency,
        status: 'active',
      },
    });
  }
}

async function main() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { status: 'published', startsAt: { gte: now } },
    include: { ticketOfferings: { select: { type: true } } },
    orderBy: { startsAt: 'asc' },
  });

  let fullSeeded = 0;
  let patched = 0;

  for (const event of events) {
    const existingTypes = new Set(event.ticketOfferings.map((o) => o.type));
    const missingTypes = OFFERING_WAVES.map((w) => w.type).filter((type) => !existingTypes.has(type));

    if (missingTypes.length === 0) {
      continue;
    }

    const basePrice = resolveBasePrice(event.countryCode, event.minPrice);

    if (existingTypes.size === 0) {
      await seedOfferingsForEvent(event.id, event.countryCode, basePrice);
      fullSeeded += 1;
      console.log(`✓ Full ticket set (incl. VIP) — ${event.title} (${event.countryCode})`);
      continue;
    }

    await seedOfferingsForEvent(event.id, event.countryCode, basePrice, missingTypes);
    patched += 1;
    console.log(
      `✓ Added missing [${missingTypes.join(', ')}] — ${event.title} (${event.countryCode})`,
    );
  }

  const withVip = await prisma.event.count({
    where: {
      status: 'published',
      startsAt: { gte: now },
      ticketOfferings: { some: { type: 'vip_general', status: 'active' } },
    },
  });
  const total = await prisma.event.count({
    where: { status: 'published', startsAt: { gte: now } },
  });

  console.log(`\nDone — ${fullSeeded} full seed, ${patched} patched`);
  console.log(`Published upcoming events with VIP tickets: ${withVip}/${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
