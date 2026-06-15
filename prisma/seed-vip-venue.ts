/**
 * Seeds VIP ticket offerings + venue layout for published events.
 * Run: npx tsx prisma/seed-vip-venue.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFERINGS = [
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

const ZONES = [
  { externalId: 'vip-1', name: 'VIP 1', kind: 'vip_table_zone' as const, status: 'available' as const, positionX: 10, positionY: 20, sizeWidth: 25, sizeHeight: 30, color: 'green', capacityPerTable: 10, isSelectable: true, displayOrder: 1 },
  { externalId: 'vip-dj', name: 'VIP DJ', kind: 'vip_premium_zone' as const, status: 'premium' as const, positionX: 40, positionY: 15, sizeWidth: 20, sizeHeight: 25, color: 'gold', capacityPerTable: 15, isSelectable: true, displayOrder: 2 },
  { externalId: 'vip-2', name: 'VIP 2', kind: 'vip_table_zone' as const, status: 'available' as const, positionX: 65, positionY: 20, sizeWidth: 25, sizeHeight: 30, color: 'green', capacityPerTable: 10, isSelectable: true, displayOrder: 3 },
  { externalId: 'stage', name: 'DJ Stage', kind: 'stage' as const, status: 'sold' as const, positionX: 35, positionY: 5, sizeWidth: 30, sizeHeight: 10, color: 'red', capacityPerTable: null, isSelectable: false, displayOrder: 4 },
  { externalId: 'dance-floor', name: 'Dance floor', kind: 'general_floor' as const, status: 'available' as const, positionX: 20, positionY: 55, sizeWidth: 60, sizeHeight: 35, color: 'green', capacityPerTable: null, isSelectable: false, displayOrder: 5 },
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

async function seedEvent(eventId: string, venueName: string, countryCode: string) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const currency = country?.currencyCode ?? 'CLP';

  for (const o of OFFERINGS) {
    await prisma.eventTicketOffering.upsert({
      where: { eventId_type: { eventId, type: o.type } },
      create: { eventId, ...o, currency },
      update: { ...o, currency },
    });
  }

  const layout = await prisma.eventVenueLayout.upsert({
    where: { eventId },
    create: {
      eventId,
      venueName,
      widthMeters: 36,
      heightMeters: 18,
    },
    update: { venueName, widthMeters: 36, heightMeters: 18 },
  });

  for (const z of ZONES) {
    const zone = await prisma.venueZone.upsert({
      where: { layoutId_externalId: { layoutId: layout.id, externalId: z.externalId } },
      create: { layoutId: layout.id, ...z },
      update: { ...z },
    });

    if (!z.isSelectable || !z.capacityPerTable) continue;

    const tableCount = z.externalId === 'vip-dj' ? 6 : 8;
    const tables = tablesForZone(z.externalId, tableCount, z.capacityPerTable, 320000);

    for (const t of tables) {
      await prisma.venueTable.upsert({
        where: { zoneId_label: { zoneId: zone.id, label: t.label } },
        create: { eventId, zoneId: zone.id, ...t, currency },
        update: { ...t, currency },
      });
    }
  }

  console.log(`✓ VIP venue seeded for event ${eventId} (${countryCode} / ${currency})`);
}

async function main() {
  const events = await prisma.event.findMany({
    where: { status: 'published' },
    select: { id: true, title: true, venueName: true, countryCode: true },
  });

  if (!events.length) {
    console.log('No published events found');
    return;
  }

  for (const event of events) {
    await seedEvent(event.id, `${event.venueName} - Main Hall`, event.countryCode);
  }

  console.log(`Done — ${events.length} event(s) updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
