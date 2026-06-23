/**
 * Seeds published events with ticket types + VIP venue layout for app purchase testing.
 * Run: npm run db:seed:purchasable
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFERINGS_TEMPLATE = [
  {
    type: 'early_bird' as const,
    name: 'Early Bird',
    price: 10000,
    displayOrder: 1,
    stockTotal: 100,
    stockRemaining: 100,
    status: 'active' as const,
  },
  {
    type: 'preventa_2' as const,
    name: 'Pre-sale 2nd wave',
    price: 13000,
    displayOrder: 2,
    stockTotal: 200,
    stockRemaining: 200,
    status: 'active' as const,
  },
  {
    type: 'preventa_3' as const,
    name: 'Pre-sale 3rd wave',
    price: 15000,
    displayOrder: 3,
    stockTotal: null,
    stockRemaining: null,
    status: 'active' as const,
  },
  {
    type: 'general' as const,
    name: 'General',
    price: 18000,
    displayOrder: 4,
    stockTotal: null,
    stockRemaining: null,
    status: 'active' as const,
  },
  {
    type: 'vip_general' as const,
    name: 'VIP General',
    price: 35000,
    displayOrder: 5,
    stockTotal: null,
    stockRemaining: null,
    status: 'active' as const,
  },
];

/** Single free general-admission wave for complimentary events. */
const FREE_OFFERINGS_TEMPLATE = [
  {
    type: 'general' as const,
    name: 'Free Entry',
    price: 0,
    displayOrder: 1,
    stockTotal: 500,
    stockRemaining: 500,
    status: 'active' as const,
  },
];

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

type PurchasableEventSeed = {
  title: string;
  description: string;
  startsAt: Date;
  venueName: string;
  city: string;
  countryCode: string;
  imageUrl: string;
  eventTypeSlug: string;
  producerName: string;
  latitude: number;
  longitude: number;
  isFeatured?: boolean;
  featuredOrder?: number;
  /** Mark first wave sold out for Section 21 sold-out UI demo */
  soldOutEarlyBird?: boolean;
  /** Only free general admission (min_price = 0, no VIP layout by default) */
  freeTicketsOnly?: boolean;
  includeVipLayout?: boolean;
};

const PURCHASABLE_EVENTS: PurchasableEventSeed[] = [
  {
    title: 'Caribe Night',
    description:
      'Ritmos caribeños frente al mar. Compra entradas generales o reserva mesa VIP.',
    startsAt: new Date('2026-07-31T21:00:00.000Z'),
    venueName: 'Club Océano',
    city: 'Viña del Mar',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    eventTypeSlug: 'parties',
    producerName: 'El Tebo',
    latitude: -33.0246,
    longitude: -71.5518,
    isFeatured: true,
    featuredOrder: 2,
    soldOutEarlyBird: true,
    includeVipLayout: true,
  },
  {
    title: 'URBAN NIGHT LIVE',
    description: 'Noche de música urbana en vivo. Preventa y mesas VIP disponibles.',
    startsAt: new Date('2026-11-21T17:00:00.000Z'),
    venueName: 'BICENTENNIAL PARK',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    eventTypeSlug: 'concerts',
    producerName: 'Sunset Productions',
    latitude: -33.4489,
    longitude: -70.6693,
    isFeatured: true,
    featuredOrder: 1,
    includeVipLayout: true,
  },
  {
    title: 'Sunset Sessions',
    description: 'DJ sets al atardecer. Entradas generales y VIP General.',
    startsAt: new Date('2026-09-12T20:00:00.000Z'),
    venueName: 'Costanera Roof',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    eventTypeSlug: 'parties',
    producerName: 'El Tebo',
    latitude: -33.4172,
    longitude: -70.6042,
    isFeatured: false,
    featuredOrder: 0,
    includeVipLayout: false,
  },
  {
    title: 'Community Open Mic Night',
    description:
      'Free entry — register and get your digital ticket. Limited capacity, first come first served.',
    startsAt: new Date('2026-08-15T19:00:00.000Z'),
    venueName: 'Barrio Creativo',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    eventTypeSlug: 'concerts',
    producerName: 'YouPass Events',
    latitude: -33.4489,
    longitude: -70.6693,
    isFeatured: true,
    featuredOrder: 1,
    freeTicketsOnly: true,
    includeVipLayout: false,
  },
];

function tablesForZone(zoneExternalId: string, count: number, capacity: number, basePrice: number) {
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
      price: zoneExternalId === 'vip-dj' ? basePrice * 1.4 : basePrice,
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

async function ensureProducer(name: string) {
  const existing = await prisma.producer.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.producer.create({
    data: { name, logoUrl: null, description: `${name} — demo promoter` },
  });
}

async function seedOfferings(
  eventId: string,
  countryCode: string,
  options: { soldOutEarlyBird?: boolean; freeOnly?: boolean },
) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const currency = country?.currencyCode ?? 'CLP';
  const template = options.freeOnly ? FREE_OFFERINGS_TEMPLATE : OFFERINGS_TEMPLATE;

  if (options.freeOnly) {
    await prisma.eventTicketOffering.updateMany({
      where: {
        eventId,
        type: { notIn: template.map((offering) => offering.type) },
      },
      data: { status: 'paused' },
    });
  }

  for (const offering of template) {
    const isSoldOutWave = options.soldOutEarlyBird && offering.type === 'early_bird';
    const stockTotal = offering.stockTotal ?? null;
    const stockRemaining =
      isSoldOutWave && stockTotal != null ? 0 : (offering.stockRemaining ?? stockTotal);
    const status = isSoldOutWave ? ('sold_out' as const) : offering.status;

    await prisma.eventTicketOffering.upsert({
      where: { eventId_type: { eventId, type: offering.type } },
      create: {
        eventId,
        type: offering.type,
        name: offering.name,
        price: offering.price,
        displayOrder: offering.displayOrder,
        currency,
        stockTotal,
        stockRemaining,
        status,
      },
      update: {
        name: offering.name,
        price: offering.price,
        displayOrder: offering.displayOrder,
        currency,
        stockTotal,
        stockRemaining,
        status,
      },
    });
  }
}

async function seedVenueLayout(eventId: string, venueName: string, countryCode: string) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const currency = country?.currencyCode ?? 'CLP';

  const layout = await prisma.eventVenueLayout.upsert({
    where: { eventId },
    create: {
      eventId,
      venueName: `${venueName} - Main Hall`,
      widthMeters: 36,
      heightMeters: 18,
    },
    update: {
      venueName: `${venueName} - Main Hall`,
      widthMeters: 36,
      heightMeters: 18,
    },
  });

  for (const zone of ZONES) {
    const record = await prisma.venueZone.upsert({
      where: { layoutId_externalId: { layoutId: layout.id, externalId: zone.externalId } },
      create: { layoutId: layout.id, ...zone },
      update: { ...zone },
    });

    if (!zone.isSelectable || !zone.capacityPerTable) continue;

    const tableCount = zone.externalId === 'vip-dj' ? 6 : 8;
    const tables = tablesForZone(zone.externalId, tableCount, zone.capacityPerTable, 320000);

    for (const table of tables) {
      await prisma.venueTable.upsert({
        where: { zoneId_label: { zoneId: record.id, label: table.label } },
        create: { eventId, zoneId: record.id, ...table, currency },
        update: { ...table, currency },
      });
    }
  }
}

async function upsertPurchasableEvent(seed: PurchasableEventSeed) {
  await ensureProducer(seed.producerName);

  const eventType = await prisma.eventType.findUnique({ where: { slug: seed.eventTypeSlug } });
  if (!eventType) {
    throw new Error(`Event type not found: ${seed.eventTypeSlug}`);
  }

  const existing = await prisma.event.findFirst({
    where: { title: seed.title, city: seed.city },
  });

  const data = {
    title: seed.title,
    description: seed.description,
    startsAt: seed.startsAt,
    venueName: seed.venueName,
    city: seed.city,
    countryCode: seed.countryCode,
    imageUrl: seed.imageUrl,
    eventTypeId: eventType.id,
    producerName: seed.producerName,
    latitude: seed.latitude,
    longitude: seed.longitude,
    status: 'published' as const,
    isFeatured: seed.isFeatured ?? false,
    featuredOrder: seed.featuredOrder ?? 0,
    venueKind: 'club_nightclub' as const,
    minPrice: seed.freeTicketsOnly ? 0 : 10000,
    currencyCode: 'CLP',
  };

  const event = existing
    ? await prisma.event.update({ where: { id: existing.id }, data })
    : await prisma.event.create({ data });

  await seedOfferings(event.id, seed.countryCode, {
    soldOutEarlyBird: seed.soldOutEarlyBird,
    freeOnly: seed.freeTicketsOnly,
  });

  if (seed.includeVipLayout !== false) {
    await seedVenueLayout(event.id, seed.venueName, seed.countryCode);
  }

  const offeringCount = await prisma.eventTicketOffering.count({ where: { eventId: event.id } });
  const layout = await prisma.eventVenueLayout.findUnique({ where: { eventId: event.id } });

  console.log(
    `✓ ${seed.title} (${event.id}) — ${offeringCount} ticket types` +
      `${layout ? ', VIP floor plan' : ''}` +
      `${seed.soldOutEarlyBird ? ', Early bird SOLD OUT' : ''}` +
      `${seed.freeTicketsOnly ? ', FREE tickets' : ''}`,
  );

  return event;
}

async function main() {
  console.log('Seeding purchasable ticket demo events…\n');

  for (const seed of PURCHASABLE_EVENTS) {
    await upsertPurchasableEvent(seed);
  }

  console.log('\nDone. Open these events in the app → Buy tickets:');
  for (const seed of PURCHASABLE_EVENTS) {
    console.log(`  • ${seed.title} (${seed.city})`);
  }
  console.log('\nPurchased tickets appear in the app Tickets tab after checkout.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
