/**
 * Seeds published events with ticket types + VIP venue layout for app purchase testing.
 * Run: npm run db:seed:purchasable
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFERINGS_TEMPLATE = [
  {
    slug: 'preventa-1',
    label: 'Preventa 1',
    section: 'general' as const,
    price: 10000,
    displayOrder: 1,
    mapsToTier: 'general' as const,
    mapsToType: 'general' as const,
    badgeLabel: 'Early bird',
    description: 'Acceso general al evento',
    stockQuantity: 100,
  },
  {
    slug: 'preventa-2',
    label: 'Preventa 2',
    section: 'general' as const,
    price: 13000,
    displayOrder: 2,
    mapsToTier: 'general' as const,
    mapsToType: 'general' as const,
    description: 'Segunda preventa — precio intermedio',
    stockQuantity: 200,
  },
  {
    slug: 'general-cover',
    label: 'General + Cover',
    section: 'general' as const,
    price: 18000,
    displayOrder: 3,
    mapsToTier: 'general' as const,
    mapsToType: 'general' as const,
    description: 'Entrada general puerta o último minuto online',
  },
  {
    slug: 'vip-general',
    label: 'VIP General',
    section: 'vip' as const,
    price: 35000,
    displayOrder: 4,
    mapsToTier: 'vip' as const,
    mapsToType: 'vip' as const,
    description: 'Sin mesa. Acceso general al evento en zona VIP',
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
];

function tablesForZone(zoneExternalId: string, count: number, capacity: number, basePrice: number) {
  return Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const label = zoneExternalId === 'vip-dj' ? `D${num}` : `M${num}`;
    return {
      externalId: `table-${zoneExternalId}-${label.toLowerCase()}`,
      number: num,
      label,
      status: i >= count - 2 ? ('sold' as const) : ('available' as const),
      positionX: 5 + (i % 4) * 12,
      positionY: 5 + Math.floor(i / 4) * 12,
      price: zoneExternalId === 'vip-dj' ? basePrice * 1.4 : basePrice,
      capacity,
      bottleCount: zoneExternalId === 'vip-dj' ? 3 : 2,
      voucherCount: zoneExternalId === 'vip-dj' ? 30 : 20,
      isPremium: zoneExternalId === 'vip-dj',
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
  options: { soldOutEarlyBird?: boolean },
) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const currency = country?.currencyCode ?? 'CLP';

  for (const offering of OFFERINGS_TEMPLATE) {
    const isSoldOutWave = options.soldOutEarlyBird && offering.slug === 'preventa-1';
    const stockQuantity = offering.stockQuantity ?? null;
    const soldQuantity = isSoldOutWave && stockQuantity ? stockQuantity : 0;

    await prisma.eventTicketOffering.upsert({
      where: { eventId_slug: { eventId, slug: offering.slug } },
      create: {
        eventId,
        ...offering,
        currency,
        stockQuantity,
        soldQuantity,
        isActive: !isSoldOutWave,
      },
      update: {
        ...offering,
        currency,
        stockQuantity,
        soldQuantity,
        isActive: !isSoldOutWave,
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
        create: { zoneId: record.id, ...table, currency },
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
    minPrice: 10000,
    currencyCode: 'CLP',
  };

  const event = existing
    ? await prisma.event.update({ where: { id: existing.id }, data })
    : await prisma.event.create({ data });

  await seedOfferings(event.id, seed.countryCode, {
    soldOutEarlyBird: seed.soldOutEarlyBird,
  });

  if (seed.includeVipLayout !== false) {
    await seedVenueLayout(event.id, seed.venueName, seed.countryCode);
  }

  const offeringCount = await prisma.eventTicketOffering.count({ where: { eventId: event.id } });
  const layout = await prisma.eventVenueLayout.findUnique({ where: { eventId: event.id } });

  console.log(
    `✓ ${seed.title} (${event.id}) — ${offeringCount} ticket types` +
      `${layout ? ', VIP floor plan' : ''}` +
      `${seed.soldOutEarlyBird ? ', Early bird SOLD OUT' : ''}`,
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
