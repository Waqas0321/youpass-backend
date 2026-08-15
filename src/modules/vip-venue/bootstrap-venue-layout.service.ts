import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../config/database.js';

const ZONES = [
  {
    externalId: 'vip-dj',
    name: 'VIP DJ',
    kind: 'vip_premium_zone' as const,
    status: 'premium' as const,
    positionX: 4,
    positionY: 10,
    sizeWidth: 22,
    sizeHeight: 24,
    color: '#a855f7',
    capacityPerTable: 10,
    isSelectable: true,
    displayOrder: 1,
  },
  {
    externalId: 'vip-2',
    name: 'VIP 2',
    kind: 'vip_table_zone' as const,
    status: 'available' as const,
    positionX: 74,
    positionY: 10,
    sizeWidth: 22,
    sizeHeight: 24,
    color: '#f472b6',
    capacityPerTable: 6,
    isSelectable: true,
    displayOrder: 2,
  },
  {
    externalId: 'vip-1',
    name: 'VIP 1',
    kind: 'vip_table_zone' as const,
    status: 'available' as const,
    positionX: 18,
    positionY: 68,
    sizeWidth: 22,
    sizeHeight: 22,
    color: '#f97316',
    capacityPerTable: 8,
    isSelectable: true,
    displayOrder: 3,
  },
  {
    externalId: 'vip-3',
    name: 'VIP 3',
    kind: 'vip_table_zone' as const,
    status: 'available' as const,
    positionX: 60,
    positionY: 68,
    sizeWidth: 22,
    sizeHeight: 22,
    color: '#f2b705',
    capacityPerTable: 10,
    isSelectable: true,
    displayOrder: 4,
  },
];

const DEFAULT_MIN_PRICES: Record<string, number> = {
  CL: 25000,
  PK: 2500,
  CO: 80000,
  MX: 500,
  PE: 60,
  AR: 15000,
  US: 50,
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
  return Array.from({ length: count }, (_, index) => {
    const num = index + 1;
    const label = zoneExternalId === 'vip-dj' ? `D${num}` : `M${num}`;
    return {
      externalId: `table-${zoneExternalId}-${label.toLowerCase()}`,
      number: num,
      label,
      status: 'available' as const,
      position: { x: 5 + (index % 4) * 12, y: 5 + Math.floor(index / 4) * 12 },
      price: Math.round(zoneExternalId === 'vip-dj' ? basePrice * 1.4 : basePrice),
      capacity,
      includes: {
        bottles: zoneExternalId === 'vip-dj' ? 3 : 2,
        bar_vouchers: zoneExternalId === 'vip-dj' ? 30 : 20,
        extras: zoneExternalId === 'vip-dj' ? ['premium_service'] : [],
      },
    };
  });
}

export async function bootstrapVenueLayoutForEvent(
  client: PrismaClient,
  event: {
    id: string;
    title: string;
    venueName: string;
    countryCode: string;
    minPrice: number | null;
    currencyCode?: string | null;
  },
) {
  const country = await client.country.findUnique({ where: { code: event.countryCode } });
  const currency =
    event.currencyCode?.trim() ||
    country?.currencyCode ||
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

  for (const zoneDef of ZONES) {
    const zone = await client.venueZone.upsert({
      where: { layoutId_externalId: { layoutId: layout.id, externalId: zoneDef.externalId } },
      create: { layoutId: layout.id, ...zoneDef },
      update: { ...zoneDef },
    });

    const tableCount = zoneDef.externalId === 'vip-dj' ? 4 : 4;
    const tables = tablesForZone(
      zoneDef.externalId,
      tableCount,
      zoneDef.capacityPerTable ?? 10,
      tableBasePrice,
    );

    for (const tableDef of tables) {
      await client.venueTable.upsert({
        where: { zoneId_label: { zoneId: zone.id, label: tableDef.label } },
        create: {
          eventId: event.id,
          zoneId: zone.id,
          currency,
          ...tableDef,
        },
        update: {
          price: tableDef.price,
          capacity: tableDef.capacity,
          includes: tableDef.includes,
          currency,
        },
      });
    }
  }

  return layout.id;
}

export async function bootstrapVenueLayoutByEventId(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      venueName: true,
      countryCode: true,
      minPrice: true,
      currencyCode: true,
    },
  });

  if (!event) {
    return null;
  }

  await bootstrapVenueLayoutForEvent(prisma, event);
  return eventId;
}
