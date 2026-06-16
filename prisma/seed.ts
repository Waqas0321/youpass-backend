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
  phoneHint?: string;
};

const PHONE_HINTS: Record<string, string> = {
  CL: '9 1234 5678',
  AR: '11 1234 5678',
  MX: '55 1234 5678',
  PE: '912 345 678',
  CO: '300 123 4567',
  UY: '99 123 456',
  PY: '981 123456',
  BO: '71234567',
  EC: '99 123 4567',
  VE: '412 1234567',
  BR: '11 91234 5678',
  CR: '8312 3456',
  PA: '6123 4567',
  GT: '5123 4567',
  SV: '7123 4567',
  HN: '9123 4567',
  NI: '8123 4567',
  DO: '809 123 4567',
  PK: '321 6548001',
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
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flagEmoji: '🇵🇰', currencyCode: 'PKR', currencySymbol: '₨', currencyDecimals: 0, languageCode: 'en', paymentGateway: 'stripe', timezone: 'Asia/Karachi', displayOrder: 19 },
];

const EVENT_TYPES = [
  { slug: 'parties', name: 'Parties', icon: '🎉', displayOrder: 1 },
  { slug: 'concerts', name: 'Concerts', icon: '🎵', displayOrder: 2 },
  { slug: 'humour', name: 'Humour', icon: '😂', displayOrder: 3 },
  { slug: 'theatre', name: 'Theatre', icon: '🎭', displayOrder: 4 },
  { slug: 'sports', name: 'Sports', icon: '⚽', displayOrder: 5 },
  { slug: 'cinema', name: 'Cinema', icon: '🎬', displayOrder: 6 },
  { slug: 'food', name: 'Food', icon: '🍽️', displayOrder: 7 },
  { slug: 'culture-art', name: 'Culture/Art', icon: '🎨', displayOrder: 8 },
  { slug: 'family', name: 'Family', icon: '👨‍👩‍👧', displayOrder: 9 },
  { slug: 'conferences', name: 'Conferences', icon: '🎤', displayOrder: 10 },
  { slug: 'bar', name: 'Bar', icon: '🍸', displayOrder: 99, isActive: false },
];

type VenueKind =
  | 'stadium'
  | 'club_nightclub'
  | 'theatre'
  | 'open_air'
  | 'events_centre'
  | 'bar_restaurant'
  | 'other';

type SampleEventSeed = {
  title: string;
  description: string;
  startsAt: Date;
  venueName: string;
  city: string;
  countryCode: string;
  imageUrl: string;
  eventTypeSlug: string;
  isFeatured: boolean;
  featuredOrder: number;
  zone?: string;
  producerName?: string;
  venueKind?: VenueKind;
  minPrice?: number;
};

function deriveEventMeta(event: SampleEventSeed) {
  const venueLower = event.venueName.toLowerCase();
  let venueKind: VenueKind = event.venueKind ?? 'other';

  if (!event.venueKind) {
    if (event.eventTypeSlug === 'sports') venueKind = 'stadium';
    else if (event.eventTypeSlug === 'parties') venueKind = 'club_nightclub';
    else if (event.eventTypeSlug === 'theatre') venueKind = 'theatre';
    else if (event.eventTypeSlug === 'bar') venueKind = 'bar_restaurant';
    else if (venueLower.includes('park') || venueLower.includes('parque') || venueLower.includes('costanera')) {
      venueKind = 'open_air';
    } else if (venueLower.includes('teatro') || venueLower.includes('theatre')) {
      venueKind = 'theatre';
    } else if (venueLower.includes('bar') || venueLower.includes('club')) {
      venueKind = venueLower.includes('club') ? 'club_nightclub' : 'bar_restaurant';
    }
  }

  const currencyByCountry: Record<string, string> = {
    CL: 'CLP',
    CO: 'COP',
    MX: 'MXN',
    PE: 'PEN',
    AR: 'ARS',
  };

  const defaultPrices: Record<string, number> = {
    CL: 25000,
    CO: 80000,
    MX: 500,
    PE: 60,
    AR: 15000,
  };

  const zone =
    event.zone ??
    (event.city === 'Las Condes'
      ? 'Las Condes'
      : event.city === 'Santiago'
        ? 'Providencia'
        : null);

  const coords = resolveCityCoordinates(event.city, event.countryCode);

  return {
    zone,
    producerName: event.producerName ?? 'YouPass Events',
    venueKind,
    minPrice: event.minPrice ?? (event.eventTypeSlug === 'bar' ? 0 : defaultPrices[event.countryCode] ?? 0),
    currencyCode: currencyByCountry[event.countryCode] ?? 'USD',
    latitude: coords?.latitude,
    longitude: coords?.longitude,
  };
}

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  Santiago: { latitude: -33.4489, longitude: -70.6693 },
  'Las Condes': { latitude: -33.4172, longitude: -70.6042 },
  'Viña del Mar': { latitude: -33.0246, longitude: -71.5518 },
  Concepción: { latitude: -36.8201, longitude: -73.0444 },
  Bogotá: { latitude: 4.711, longitude: -74.0721 },
  'Ciudad de México': { latitude: 19.4326, longitude: -99.1332 },
  Lima: { latitude: -12.0464, longitude: -77.0428 },
  Cartagena: { latitude: 10.391, longitude: -75.4794 },
  Antofagasta: { latitude: -23.6509, longitude: -70.3975 },
  Valparaíso: { latitude: -33.0472, longitude: -71.6127 },
};

function resolveCityCoordinates(city: string, countryCode: string) {
  const direct = CITY_COORDINATES[city];
  if (direct) {
    return direct;
  }

  if (countryCode === 'CL') {
    return CITY_COORDINATES.Santiago;
  }

  return undefined;
}

async function seedInvitationConfig() {
  await prisma.invitationConfig.upsert({
    where: { configKey: 'default' },
    create: {
      configKey: 'default',
      expiryDays: 3,
    },
    update: {
      expiryDays: 3,
    },
  });
  console.log('Seeded invitation expiry config');
}

async function seedEventListingConfig() {
  await prisma.eventListingConfig.upsert({
    where: { configKey: 'default' },
    create: {
      configKey: 'default',
      dateWeight: 0.5,
      locationWeight: 0.3,
      featuredWeight: 0.2,
      pageSize: 20,
    },
    update: {
      dateWeight: 0.5,
      locationWeight: 0.3,
      featuredWeight: 0.2,
      pageSize: 20,
    },
  });
  console.log('Seeded event listing sort config');
}

const SAMPLE_EVENTS: SampleEventSeed[] = [
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
  {
    title: 'Salsa Night Lima',
    description: 'Live salsa bands and dance floor all night.',
    startsAt: new Date('2026-08-22T23:00:00.000Z'),
    venueName: 'La Noche Club',
    city: 'Lima',
    countryCode: 'PE',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
    eventTypeSlug: 'parties',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Neon Disco CDMX',
    description: 'Retro-futuristic disco experience in Roma Norte.',
    startsAt: new Date('2026-09-05T02:00:00.000Z'),
    venueName: 'Palmares Rooftop',
    city: 'Ciudad de México',
    countryCode: 'MX',
    imageUrl: 'https://images.unsplash.com/photo-1571266028243-e4733b2d325c?w=800',
    eventTypeSlug: 'parties',
    isFeatured: true,
    featuredOrder: 4,
  },
  {
    title: 'Techno Warehouse',
    description: 'Underground techno until sunrise.',
    startsAt: new Date('2026-06-10T23:00:00.000Z'),
    venueName: 'Fabrica B',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'VIP Lounge Experience',
    description: 'Exclusive lounge night with live DJ and premium bar.',
    startsAt: new Date('2026-06-05T21:00:00.000Z'),
    venueName: 'Sky Bar',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1429962710811-db857818a988?w=800',
    eventTypeSlug: 'bar',
    isFeatured: false,
    featuredOrder: 0,
  },
  {
    title: 'Pool Party Cartagena',
    description: 'Beach club pool party with international DJs.',
    startsAt: new Date('2026-11-28T18:00:00.000Z'),
    venueName: 'Cafe del Mar',
    city: 'Cartagena',
    countryCode: 'CO',
    imageUrl: 'https://images.unsplash.com/photo-1533170792547-88a0d66a3926?w=800',
    eventTypeSlug: 'parties',
    isFeatured: true,
    featuredOrder: 5,
  },
  {
    title: 'Santiago Live Tonight',
    description: 'Live music tonight — QR unlocks on event day.',
    startsAt: new Date('2026-06-04T00:00:00.000Z'),
    venueName: 'Teatro Coliseo',
    city: 'Santiago',
    countryCode: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    eventTypeSlug: 'concerts',
    isFeatured: false,
    featuredOrder: 0,
  },
];

async function main() {
  for (const country of LATAM_COUNTRIES) {
    const { code, ...data } = country;
    const phoneHint = PHONE_HINTS[code] ?? null;
    await prisma.country.upsert({
      where: { code },
      update: { ...data, phoneHint },
      create: { ...country, phoneHint },
    });
  }
  console.log(`Seeded ${LATAM_COUNTRIES.length} countries`);

  const typeBySlug = new Map<string, string>();

  for (const type of EVENT_TYPES) {
    const { isActive, ...typeData } = type as (typeof EVENT_TYPES)[number] & { isActive?: boolean };
    const record = await prisma.eventType.upsert({
      where: { slug: type.slug },
      update: {
        name: type.name,
        icon: type.icon,
        displayOrder: type.displayOrder,
        ...(isActive === undefined ? {} : { isActive }),
      },
      create: {
        ...typeData,
        isActive: isActive ?? true,
      },
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
      const meta = deriveEventMeta(event);
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
          ...meta,
        },
      });
    } else {
      const meta = deriveEventMeta(event);
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
          ...meta,
        },
      });
    }
  }
  console.log(`Seeded ${SAMPLE_EVENTS.length} sample events`);

  await seedEventListingConfig();
  await seedInvitationConfig();
  await seedHomeBannerSlides();

  const { seedInvitations } = await import('./seed-invitations.js');
  await seedInvitations(prisma);

  const { seedWaitlist } = await import('./seed-waitlist.js');
  await seedWaitlist(prisma);
}

async function seedHomeBannerSlides() {
  const displayStartsAt = new Date('2025-01-01T00:00:00.000Z');
  const displayEndsAt = new Date('2030-12-31T23:59:59.000Z');

  const bannerSeeds = [
    {
      title: 'URBAN NIGHT LIVE',
      subtitle: 'Premium urban music experience',
      eventTitle: 'URBAN NIGHT LIVE',
      priority: 1,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Caribe Night',
      subtitle: 'Feel the Caribbean rhythm',
      eventTitle: 'Caribe Night',
      priority: 2,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Sunset Sessions',
      subtitle: 'Open-air DJ sets at golden hour',
      eventTitle: 'Sunset Sessions',
      priority: 3,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Reggaeton Beach',
      subtitle: 'Summer reggaeton on the coast',
      eventTitle: 'Reggaeton Beach',
      priority: 4,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Electronic Garden',
      subtitle: 'Electronic music under the stars',
      eventTitle: 'Electronic Garden',
      priority: 5,
      aspectRatio: '21:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Indie Vibes Live',
      subtitle: 'Independent bands from across Chile',
      eventTitle: 'Indie Vibes Live',
      priority: 6,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Latin Cocktail Night',
      subtitle: 'Craft cocktails and Latin beats',
      eventTitle: 'Latin Cocktail Night',
      priority: 7,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Techno Warehouse',
      subtitle: 'Underground techno until sunrise',
      eventTitle: 'Techno Warehouse',
      priority: 8,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'VIP Lounge Experience',
      subtitle: 'Exclusive lounge with live DJ',
      eventTitle: 'VIP Lounge Experience',
      priority: 9,
      aspectRatio: '16:9',
      countryCodes: ['CL'],
    },
    {
      title: 'Rock al Parque',
      subtitle: 'The biggest rock festival in Bogotá',
      eventTitle: 'Rock al Parque',
      priority: 10,
      aspectRatio: '21:9',
      countryCodes: ['CO'],
    },
    {
      title: 'Neon Disco CDMX',
      subtitle: 'Retro-futuristic disco experience',
      eventTitle: 'Neon Disco CDMX',
      priority: 11,
      aspectRatio: '16:9',
      countryCodes: ['MX'],
    },
  ];

  let seeded = 0;

  for (const seed of bannerSeeds) {
    const event = await prisma.event.findFirst({
      where: { title: seed.eventTitle, status: 'published' },
    });

    if (!event?.imageUrl) {
      continue;
    }

    const existing = await prisma.homeBannerSlide.findFirst({
      where: {
        title: seed.title,
        eventId: event.id,
      },
    });

    const data = {
      title: seed.title,
      subtitle: seed.subtitle,
      imageUrl: event.imageUrl,
      tapActionType: 'event_detail' as const,
      eventId: event.id,
      displayStartsAt,
      displayEndsAt,
      countryCodes: seed.countryCodes,
      cities: [] as string[],
      userCategories: [],
      priority: seed.priority,
      aspectRatio: seed.aspectRatio,
      isActive: true,
    };

    if (existing) {
      await prisma.homeBannerSlide.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.homeBannerSlide.create({ data });
    }

    seeded += 1;
  }

  console.log(`Seeded ${seeded} home banner slides`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
