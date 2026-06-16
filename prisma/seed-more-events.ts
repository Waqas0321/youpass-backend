/**
 * Seeds additional published events (Pakistan-focused) + ticket offerings + home banners.
 * Safe to re-run (upserts by title + city).
 *
 * Run: npm run db:seed:more
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { deriveVenueKind } from '../src/common/utils/venue-kind-filter.js';
import { seedVenueLayoutForEvent } from './seed-venue-layout.js';

const prisma = new PrismaClient();

const IMAGES = [
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
  'https://images.unsplash.com/photo-1415201364774-f6f0ff35aa28?w=800',
  'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
  'https://images.unsplash.com/photo-1571266028243-e4733b2d325c?w=800',
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
  'https://images.unsplash.com/photo-1429962710811-db857818a988?w=800',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
];

type EventSeed = {
  title: string;
  description: string;
  startsAt: Date;
  venueName: string;
  city: string;
  countryCode: string;
  eventTypeSlug: string;
  producerName?: string;
  minPrice?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
};

const MORE_EVENTS: EventSeed[] = [
  {
    title: 'Lahore Beats Festival',
    description: 'Open-air festival with local and international DJs.',
    startsAt: new Date('2026-07-18T18:00:00.000Z'),
    venueName: 'Fortress Stadium',
    city: 'Lahore',
    countryCode: 'PK',
    eventTypeSlug: 'parties',
    producerName: 'PK Live',
    minPrice: 2500,
    isFeatured: true,
    featuredOrder: 1,
  },
  {
    title: 'Karachi Rooftop Sessions',
    description: 'Sunset house music above the Arabian Sea.',
    startsAt: new Date('2026-08-02T19:30:00.000Z'),
    venueName: 'Ocean Towers Rooftop',
    city: 'Karachi',
    countryCode: 'PK',
    eventTypeSlug: 'bar',
    producerName: 'PK Live',
    minPrice: 1800,
    isFeatured: true,
    featuredOrder: 2,
  },
  {
    title: 'Islamabad Jazz Night',
    description: 'Smooth jazz and craft mocktails in the capital.',
    startsAt: new Date('2026-08-16T17:00:00.000Z'),
    venueName: 'Jazz Lounge F-7',
    city: 'Islamabad',
    countryCode: 'PK',
    eventTypeSlug: 'concerts',
    producerName: 'Capital Sounds',
    minPrice: 2000,
  },
  {
    title: 'Qawwali & Chill',
    description: 'Traditional qawwali with a modern lounge vibe.',
    startsAt: new Date('2026-09-06T20:00:00.000Z'),
    venueName: 'Alhamra Arts Center',
    city: 'Lahore',
    countryCode: 'PK',
    eventTypeSlug: 'concerts',
    producerName: 'Capital Sounds',
    minPrice: 1500,
  },
  {
    title: 'EDM Night Karachi',
    description: 'High-energy EDM until late with top local DJs.',
    startsAt: new Date('2026-09-20T21:00:00.000Z'),
    venueName: 'Port Grand',
    city: 'Karachi',
    countryCode: 'PK',
    eventTypeSlug: 'parties',
    producerName: 'PK Live',
    minPrice: 3000,
    isFeatured: true,
    featuredOrder: 3,
  },
  {
    title: 'Comedy & Cocktails',
    description: 'Stand-up night with signature drinks.',
    startsAt: new Date('2026-10-04T18:30:00.000Z'),
    venueName: 'The Second Floor',
    city: 'Islamabad',
    countryCode: 'PK',
    eventTypeSlug: 'bar',
    producerName: 'Capital Sounds',
    minPrice: 1200,
  },
  {
    title: 'Food Truck Fiesta',
    description: 'Street food, live bands, and family-friendly vibes.',
    startsAt: new Date('2026-10-18T15:00:00.000Z'),
    venueName: 'Lake View Park',
    city: 'Islamabad',
    countryCode: 'PK',
    eventTypeSlug: 'parties',
    producerName: 'PK Live',
    minPrice: 800,
  },
  {
    title: 'Peshawar Cultural Night',
    description: 'Folk music, dance, and regional cuisine showcase.',
    startsAt: new Date('2026-11-01T17:30:00.000Z'),
    venueName: 'Nishtar Hall',
    city: 'Peshawar',
    countryCode: 'PK',
    eventTypeSlug: 'concerts',
    producerName: 'Capital Sounds',
    minPrice: 1000,
  },
  {
    title: 'Winter Wonderland PK',
    description: 'Holiday market with DJs and light installations.',
    startsAt: new Date('2026-12-20T16:00:00.000Z'),
    venueName: 'Packages Mall',
    city: 'Lahore',
    countryCode: 'PK',
    eventTypeSlug: 'parties',
    producerName: 'PK Live',
    minPrice: 2200,
    isFeatured: true,
    featuredOrder: 4,
  },
  {
    title: 'New Year Gala Islamabad',
    description: 'Countdown party with fireworks and live orchestra.',
    startsAt: new Date('2026-12-31T20:00:00.000Z'),
    venueName: 'Serena Hotel Ballroom',
    city: 'Islamabad',
    countryCode: 'PK',
    eventTypeSlug: 'parties',
    producerName: 'PK Live',
    minPrice: 5000,
    isFeatured: true,
    featuredOrder: 5,
  },
  {
    title: 'Santiago Summer Block Party',
    description: 'Street party with food trucks and live DJs.',
    startsAt: new Date('2026-12-12T22:00:00.000Z'),
    venueName: 'Barrio Italia',
    city: 'Santiago',
    countryCode: 'CL',
    eventTypeSlug: 'parties',
    producerName: 'Sunset Productions',
    minPrice: 12000,
  },
  {
    title: 'Valparaíso Sunset Cruise',
    description: 'Boat party along the Pacific coast.',
    startsAt: new Date('2026-12-18T21:00:00.000Z'),
    venueName: 'Muelle Prat',
    city: 'Valparaíso',
    countryCode: 'CL',
    eventTypeSlug: 'bar',
    producerName: 'El Tebo',
    minPrice: 18000,
  },
];

const OFFERING_WAVES = [
  { type: 'early_bird' as const, name: 'Early Bird', multiplier: 1, displayOrder: 1, stockTotal: 80 },
  { type: 'preventa_2' as const, name: 'Pre-sale 2nd wave', multiplier: 1.3, displayOrder: 2, stockTotal: 150 },
  { type: 'preventa_3' as const, name: 'Pre-sale 3rd wave', multiplier: 1.5, displayOrder: 3, stockTotal: null },
  { type: 'general' as const, name: 'General', multiplier: 1.6, displayOrder: 4, stockTotal: null },
  { type: 'vip_general' as const, name: 'VIP General', multiplier: 2.5, displayOrder: 5, stockTotal: null },
];

const PK_BANNER_SEEDS = [
  { title: 'Lahore Beats Festival', subtitle: 'Open-air DJs in Lahore', eventTitle: 'Lahore Beats Festival', priority: 20 },
  { title: 'Karachi Rooftop Sessions', subtitle: 'Sunset house by the sea', eventTitle: 'Karachi Rooftop Sessions', priority: 21 },
  { title: 'EDM Night Karachi', subtitle: 'High-energy EDM all night', eventTitle: 'EDM Night Karachi', priority: 22 },
  { title: 'New Year Gala Islamabad', subtitle: 'Ring in 2027 in style', eventTitle: 'New Year Gala Islamabad', priority: 23 },
];

async function ensureProducer(name: string) {
  const existing = await prisma.producer.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.producer.create({
    data: { name, logoUrl: null, description: `${name} — demo promoter` },
  });
}

async function upsertEvent(seed: EventSeed, eventTypeId: string, imageUrl: string) {
  const producer = seed.producerName ? await ensureProducer(seed.producerName) : null;
  const venueKind = deriveVenueKind({
    eventTypeSlug: seed.eventTypeSlug,
    venueName: seed.venueName,
  });

  const data = {
    description: seed.description,
    startsAt: seed.startsAt,
    venueName: seed.venueName,
    countryCode: seed.countryCode,
    imageUrl: seed.imageUrl ?? imageUrl,
    eventTypeId,
    producerName: seed.producerName ?? null,
    minPrice: seed.minPrice ?? null,
    currencyCode: seed.countryCode === 'PK' ? 'PKR' : seed.countryCode === 'CL' ? 'CLP' : null,
    venueKind,
    isFeatured: seed.isFeatured ?? false,
    featuredOrder: seed.featuredOrder ?? 0,
    status: 'published' as const,
    latitude: seed.latitude ?? null,
    longitude: seed.longitude ?? null,
  };

  const existing = await prisma.event.findFirst({
    where: { title: seed.title, city: seed.city },
  });

  if (existing) {
    return prisma.event.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.event.create({
    data: {
      title: seed.title,
      city: seed.city,
      ...data,
    },
  });
}

async function seedOfferings(eventId: string, countryCode: string, basePrice: number) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const currency = country?.currencyCode ?? (countryCode === 'PK' ? 'PKR' : 'CLP');

  for (const wave of OFFERING_WAVES) {
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
        stockTotal: wave.stockTotal,
        stockRemaining: wave.stockTotal,
        status: 'active',
      },
    });
  }
}

async function seedPkBanners() {
  const displayStartsAt = new Date('2025-01-01T00:00:00.000Z');
  const displayEndsAt = new Date('2030-12-31T23:59:59.000Z');
  let seeded = 0;

  for (const seed of PK_BANNER_SEEDS) {
    const event = await prisma.event.findFirst({
      where: { title: seed.eventTitle, status: 'published' },
    });
    if (!event?.imageUrl) continue;

    const existing = await prisma.homeBannerSlide.findFirst({
      where: { title: seed.title, countryCodes: { has: 'PK' } },
    });

    const payload = {
      title: seed.title,
      subtitle: seed.subtitle,
      imageUrl: event.imageUrl,
      tapActionType: 'event_detail' as const,
      eventId: event.id,
      displayStartsAt,
      displayEndsAt,
      countryCodes: ['PK'],
      priority: seed.priority,
      aspectRatio: '16:9',
      isActive: true,
    };

    if (existing) {
      await prisma.homeBannerSlide.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.homeBannerSlide.create({ data: payload });
    }
    seeded += 1;
  }

  console.log(`Home banners (PK): ${seeded} upserted`);
}

async function main() {
  const types = await prisma.eventType.findMany();
  const typeBySlug = new Map(types.map((t) => [t.slug, t.id]));

  let created = 0;
  let updated = 0;

  for (let i = 0; i < MORE_EVENTS.length; i++) {
    const seed = MORE_EVENTS[i]!;
    const eventTypeId = typeBySlug.get(seed.eventTypeSlug);
    if (!eventTypeId) {
      console.warn(`Skipped ${seed.title} — unknown type ${seed.eventTypeSlug}`);
      continue;
    }

    const existing = await prisma.event.findFirst({
      where: { title: seed.title, city: seed.city },
    });

    const event = await upsertEvent(seed, eventTypeId, IMAGES[i % IMAGES.length]!);
    if (existing) updated += 1;
    else created += 1;

    if (seed.minPrice != null) {
      await seedOfferings(event.id, seed.countryCode, seed.minPrice);
    }

    if (seed.eventTypeSlug === 'parties') {
      await seedVenueLayoutForEvent(prisma, {
        id: event.id,
        title: event.title,
        venueName: event.venueName,
        countryCode: event.countryCode,
        minPrice: event.minPrice,
      });
    }

    console.log(`✓ ${seed.title} (${seed.city}, ${seed.countryCode})`);
  }

  await seedPkBanners();

  const pkCount = await prisma.event.count({
    where: { countryCode: 'PK', status: 'published', startsAt: { gte: new Date() } },
  });

  console.log(`\nDone — ${created} created, ${updated} updated`);
  console.log(`Published upcoming PK events: ${pkCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
