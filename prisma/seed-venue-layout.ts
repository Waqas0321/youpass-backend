/**
 * Seeds VIP venue layout (zones + tables) for published events.
 * Does not overwrite existing ticket offerings.
 *
 * Run all missing layouts: npm run db:seed:venue-layout
 * Run one event: npm run db:seed:venue-layout -- --title="Lahore Beats Festival"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ZONES = [
  {
    externalId: 'vip-1',
    name: 'VIP 1',
    kind: 'vip_table_zone' as const,
    status: 'available' as const,
    positionX: 10,
    positionY: 20,
    sizeWidth: 25,
    sizeHeight: 30,
    color: 'green',
    capacityPerTable: 10,
    isSelectable: true,
    displayOrder: 1,
  },
  {
    externalId: 'vip-dj',
    name: 'VIP DJ',
    kind: 'vip_premium_zone' as const,
    status: 'premium' as const,
    positionX: 40,
    positionY: 15,
    sizeWidth: 20,
    sizeHeight: 25,
    color: 'gold',
    capacityPerTable: 15,
    isSelectable: true,
    displayOrder: 2,
  },
  {
    externalId: 'vip-2',
    name: 'VIP 2',
    kind: 'vip_table_zone' as const,
    status: 'available' as const,
    positionX: 65,
    positionY: 20,
    sizeWidth: 25,
    sizeHeight: 30,
    color: 'green',
    capacityPerTable: 10,
    isSelectable: true,
    displayOrder: 3,
  },
  {
    externalId: 'stage',
    name: 'DJ Stage',
    kind: 'stage' as const,
    status: 'sold' as const,
    positionX: 35,
    positionY: 5,
    sizeWidth: 30,
    sizeHeight: 10,
    color: 'red',
    capacityPerTable: null,
    isSelectable: false,
    displayOrder: 4,
  },
  {
    externalId: 'dance-floor',
    name: 'Dance floor',
    kind: 'general_floor' as const,
    status: 'available' as const,
    positionX: 20,
    positionY: 55,
    sizeWidth: 60,
    sizeHeight: 35,
    color: 'green',
    capacityPerTable: null,
    isSelectable: false,
    displayOrder: 5,
  },
];

const DEFAULT_MIN_PRICES: Record<string, number> = {
  CL: 25000,
  PK: 2500,
  CO: 80000,
  MX: 500,
  PE: 60,
  AR: 15000,
  DEFAULT: 10000,
};

function resolveTableBasePrice(minPrice: number | null, countryCode: string) {
  const base =
    minPrice != null && minPrice > 0
      ? minPrice
      : DEFAULT_MIN_PRICES[countryCode] ?? DEFAULT_MIN_PRICES.DEFAULT;
  return Math.round(base * 30);
}

function tablesForZone(
  zoneExternalId: string,
  count: number,
  capacity: number,
  basePrice: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const label = zoneExternalId === 'vip-dj' ? `D${num}` : `M${num}`;
    const isSold = i >= count - 2;
    return {
      externalId: `table-${zoneExternalId}-${label.toLowerCase()}`,
      number: num,
      label,
      status: isSold ? ('sold' as const) : ('available' as const),
      position: { x: 5 + (i % 4) * 12, y: 5 + Math.floor(i / 4) * 12 },
      price: Math.round(zoneExternalId === 'vip-dj' ? basePrice * 1.4 : basePrice),
      capacity,
      includes: {
        bottles: zoneExternalId === 'vip-dj' ? 3 : 2,
        bar_vouchers: zoneExternalId === 'vip-dj' ? 30 : 20,
        extras: zoneExternalId === 'vip-dj' ? ['premium_service'] : [],
      },
      soldAt: isSold ? new Date() : null,
    };
  });
}

export async function seedVenueLayoutForEvent(
  client: PrismaClient,
  event: {
    id: string;
    title: string;
    venueName: string;
    countryCode: string;
    minPrice: number | null;
  },
) {
  const country = await client.country.findUnique({ where: { code: event.countryCode } });
  const currency =
    country?.currencyCode ??
    (event.countryCode === 'PK' ? 'PKR' : event.countryCode === 'CL' ? 'CLP' : 'USD');
  const tableBasePrice = resolveTableBasePrice(event.minPrice, event.countryCode);
  const layoutLabel = `${event.venueName} — VIP Floor`;

  const layout = await client.eventVenueLayout.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      venueName: layoutLabel,
      widthMeters: 36,
      heightMeters: 18,
      tableLockMinutes: 10,
    },
    update: {
      venueName: layoutLabel,
      widthMeters: 36,
      heightMeters: 18,
    },
  });

  for (const z of ZONES) {
    const zone = await client.venueZone.upsert({
      where: { layoutId_externalId: { layoutId: layout.id, externalId: z.externalId } },
      create: { layoutId: layout.id, ...z },
      update: { ...z },
    });

    if (!z.isSelectable || !z.capacityPerTable) {
      continue;
    }

    const tableCount = z.externalId === 'vip-dj' ? 6 : 8;
    const tables = tablesForZone(
      z.externalId,
      tableCount,
      z.capacityPerTable,
      tableBasePrice,
    );

    for (const t of tables) {
      await client.venueTable.upsert({
        where: { zoneId_label: { zoneId: zone.id, label: t.label } },
        create: { eventId: event.id, zoneId: zone.id, ...t, currency },
        update: { ...t, currency },
      });
    }
  }

  console.log(
    `✓ Venue layout — ${event.title} (${currency}, tables from ${tableBasePrice})`,
  );
}

function readTitleFilter(argv: string[]) {
  const titleArg = argv.find((arg) => arg.startsWith('--title='));
  if (!titleArg) {
    return null;
  }
  return titleArg.slice('--title='.length).replace(/^"|"$/g, '');
}

async function main() {
  const titleFilter = readTitleFilter(process.argv.slice(2));

  const events = await prisma.event.findMany({
    where: {
      status: 'published',
      ...(titleFilter ? { title: titleFilter } : {}),
    },
    select: {
      id: true,
      title: true,
      venueName: true,
      countryCode: true,
      minPrice: true,
      venueLayout: { select: { id: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  if (!events.length) {
    console.log(titleFilter ? `No event found: ${titleFilter}` : 'No published events found');
    return;
  }

  let seeded = 0;
  for (const event of events) {
    if (event.venueLayout && !titleFilter) {
      continue;
    }
    await seedVenueLayoutForEvent(prisma, event);
    seeded += 1;
  }

  console.log(`\nDone — ${seeded} venue layout(s) seeded`);
}

const isDirectRun = process.argv[1]?.includes('seed-venue-layout');

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
