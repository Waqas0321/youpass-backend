import { PrismaClient, PaymentGateway } from '@prisma/client';

const prisma = new PrismaClient();

type CountrySeed = {
  code: string;
  name: string;
  dialCode: string;
  flagEmoji: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  languageCode: string;
  paymentGateway: PaymentGateway;
  timezone: string;
  displayOrder: number;
};

const LATAM_COUNTRIES: CountrySeed[] = [
  { code: 'CL', name: 'Chile', dialCode: '+56', flagEmoji: '🇨🇱', currencyCode: 'CLP', currencySymbol: '$', currencyDecimals: 0, languageCode: 'es', paymentGateway: 'klap', timezone: 'America/Santiago', displayOrder: 1 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flagEmoji: '🇦🇷', currencyCode: 'ARS', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Argentina/Buenos_Aires', displayOrder: 2 },
  { code: 'MX', name: 'México', dialCode: '+52', flagEmoji: '🇲🇽', currencyCode: 'MXN', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Mexico_City', displayOrder: 3 },
  { code: 'PE', name: 'Perú', dialCode: '+51', flagEmoji: '🇵🇪', currencyCode: 'PEN', currencySymbol: 'S/', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Lima', displayOrder: 4 },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flagEmoji: '🇨🇴', currencyCode: 'COP', currencySymbol: '$', currencyDecimals: 0, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Bogota', displayOrder: 5 },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flagEmoji: '🇺🇾', currencyCode: 'UYU', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Montevideo', displayOrder: 6 },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flagEmoji: '🇵🇾', currencyCode: 'PYG', currencySymbol: '₲', currencyDecimals: 0, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Asuncion', displayOrder: 7 },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flagEmoji: '🇧🇴', currencyCode: 'BOB', currencySymbol: 'Bs.', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/La_Paz', displayOrder: 8 },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flagEmoji: '🇪🇨', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Guayaquil', displayOrder: 9 },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flagEmoji: '🇻🇪', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Caracas', displayOrder: 10 },
  { code: 'BR', name: 'Brasil', dialCode: '+55', flagEmoji: '🇧🇷', currencyCode: 'BRL', currencySymbol: 'R$', currencyDecimals: 2, languageCode: 'pt', paymentGateway: 'stripe', timezone: 'America/Sao_Paulo', displayOrder: 11 },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flagEmoji: '🇨🇷', currencyCode: 'CRC', currencySymbol: '₡', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Costa_Rica', displayOrder: 12 },
  { code: 'PA', name: 'Panamá', dialCode: '+507', flagEmoji: '🇵🇦', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Panama', displayOrder: 13 },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flagEmoji: '🇬🇹', currencyCode: 'GTQ', currencySymbol: 'Q', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Guatemala', displayOrder: 14 },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flagEmoji: '🇸🇻', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/El_Salvador', displayOrder: 15 },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flagEmoji: '🇭🇳', currencyCode: 'HNL', currencySymbol: 'L', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Tegucigalpa', displayOrder: 16 },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flagEmoji: '🇳🇮', currencyCode: 'NIO', currencySymbol: 'C$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Managua', displayOrder: 17 },
  { code: 'DO', name: 'República Dominicana', dialCode: '+1-809', flagEmoji: '🇩🇴', currencyCode: 'DOP', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Santo_Domingo', displayOrder: 18 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flagEmoji: '🇵🇰', currencyCode: 'PKR', currencySymbol: '₨', currencyDecimals: 2, languageCode: 'en', paymentGateway: 'stripe', timezone: 'Asia/Karachi', displayOrder: 19 },
];

const EVENT_TYPES = [
  { slug: 'parties', name: 'Parties', icon: '🎉', displayOrder: 1 },
  { slug: 'concerts', name: 'Concerts', icon: '🎵', displayOrder: 2 },
  { slug: 'bar', name: 'Bar', icon: '🍸', displayOrder: 3 },
];

const SAMPLE_EVENTS = [
  {
    title: 'URBAN NIGHT LIVE',
    description: 'Live urban music night in the heart of Santiago.',
    startsAt: new Date('2026-11-21T17:00:00.000Z'),
    venueName: 'BICENTENNIAL PARK',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: true,
    featuredOrder: 1,
  },
  {
    title: 'Caribe Night',
    description: 'Caribbean rhythms by the coast.',
    startsAt: new Date('2026-07-31T21:00:00.000Z'),
    venueName: 'Club Océano',
    city: 'Viña del Mar',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    eventTypeSlug: 'parties',
    isFeatured: true,
    featuredOrder: 2,
  },
  {
    title: 'Rock al Parque',
    description: 'The biggest rock festival in Bogotá.',
    startsAt: new Date('2026-08-02T18:00:00.000Z'),
    venueName: 'Simón Bolívar Park',
    city: 'Bogotá',
    countryCode: 'CO',
    imageUrl: 'https://images.unsplash.com/photo-1459749411177-0410a7948c1a?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: true,
    featuredOrder: 3,
  },
  // Non-featured — shown on "See all" (GET /events?country_code=CL)
  {
    title: 'Sunset Sessions',
    description: 'Open-air DJ sets at golden hour.',
    startsAt: new Date('2026-09-12T20:00:00.000Z'),
    venueName: 'Costanera Roof',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    eventTypeSlug: 'parties',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Jazz & Wine',
    description: 'Smooth jazz with Chilean wine tasting.',
    startsAt: new Date('2026-09-20T19:30:00.000Z'),
    venueName: 'Bar Constitución',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0ff35aa28?w=800',
    eventTypeSlug: 'bar',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Electronic Garden',
    description: 'Electronic music under the stars.',
    startsAt: new Date('2026-10-05T22:00:00.000Z'),
    venueName: 'Parque Araucano',
    city: 'Las Condes',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1571266028243-e4733b2d325c?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Reggaeton Beach',
    description: 'Summer reggaeton party on the beach.',
    startsAt: new Date('2026-10-18T18:00:00.000Z'),
    venueName: 'Playa Acapulco',
    city: 'Viña del Mar',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
    eventTypeSlug: 'parties',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Indie Vibes Live',
    description: 'Independent bands from across Chile.',
    startsAt: new Date('2026-11-08T21:00:00.000Z'),
    venueName: 'Teatro Caupolicán',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Latin Cocktail Night',
    description: 'Craft cocktails and Latin beats.',
    startsAt: new Date('2026-11-15T20:30:00.000Z'),
    venueName: 'Bar Liguria',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d87?w=800',
    eventTypeSlug: 'bar',
    isFeatured: false,
    featuredOrder: 0,
  },
];

async function main() {
  for (const country of LATAM_COUNTRIES) {
    const { code, ...data } = country;
    await prisma.country.upsert({
      where: { code },
      update: data,
      create: country,
    });
  }
  console.log(`Seeded ${LATAM_COUNTRIES.length} countries`);

  const typeBySlug = new Map<string, string>();

  for (const type of EVENT_TYPES) {
    const record = await prisma.eventType.upsert({
      where: { slug: type.slug },
      update: {
        name: type.name,
        icon: type.icon,
        displayOrder: type.displayOrder,
        isActive: true,
      },
      create: type,
    });
    typeBySlug.set(type.slug, record.id);
  }
  console.log(`Seeded ${EVENT_TYPES.length} event types`);

  for (const event of SAMPLE_EVENTS) {
    const eventTypeId = typeBySlug.get(event.eventTypeSlug);
    if (!eventTypeId) continue;

    const existing = await prisma.event.findFirst({
      where: { title: event.title, city: event.city },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          description: event.description,
          startsAt: event.startsAt,
          venueName: event.venueName,
          countryCode: event.countryCode,
          imageUrl: event.imageUrl,
          eventTypeId,
          isFeatured: event.isFeatured,
          featuredOrder: event.featuredOrder,
          status: 'published',
        },
      });
    } else {
      await prisma.event.create({
        data: {
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          venueName: event.venueName,
          city: event.city,
          countryCode: event.countryCode,
          imageUrl: event.imageUrl,
          eventTypeId,
          isFeatured: event.isFeatured,
          featuredOrder: event.featuredOrder,
          status: 'published',
        },
      });
    }
  }
  console.log(`Seeded ${SAMPLE_EVENTS.length} sample events`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
