import type { ProducerEvent } from './types';

const TICKET_COLORS = {
  general: '#a855f7',
  vip: '#22c55e',
  vipTable: '#ffb800',
  backstage: '#ec4899',
  courtesy: '#f97316',
} as const;

function buildCaribeNightSales(capacity: number) {
  const sold = Math.round(capacity * 0.75);
  return {
    salesStatus: 'active' as const,
    ticketsSold: sold,
    ticketCategories: [
      { id: 'general' as const, sold: 1012, total: 1350, color: TICKET_COLORS.general },
      { id: 'vip' as const, sold: 528, total: 700, color: TICKET_COLORS.vip },
      { id: 'vipTable' as const, sold: 240, total: 320, color: TICKET_COLORS.vipTable },
      { id: 'backstage' as const, sold: 95, total: 130, color: TICKET_COLORS.backstage },
      { id: 'courtesy' as const, sold: 0, total: 0, color: TICKET_COLORS.courtesy },
    ],
  };
}

function defaultSales(capacity: number) {
  const sold = Math.round(capacity * 0.62);
  return {
    salesStatus: 'active' as const,
    ticketsSold: sold,
    ticketCategories: [
      { id: 'general' as const, sold: Math.round(sold * 0.54), total: Math.round(capacity * 0.54), color: TICKET_COLORS.general },
      { id: 'vip' as const, sold: Math.round(sold * 0.28), total: Math.round(capacity * 0.28), color: TICKET_COLORS.vip },
      { id: 'vipTable' as const, sold: Math.round(sold * 0.12), total: Math.round(capacity * 0.12), color: TICKET_COLORS.vipTable },
      { id: 'backstage' as const, sold: Math.round(sold * 0.06), total: Math.round(capacity * 0.06), color: TICKET_COLORS.backstage },
    ],
  };
}

export const producerEventCatalog: ProducerEvent[] = [
  {
    id: 'caribe-night',
    title: 'Caribe Night',
    displayTitle: 'Caribe Night 2026',
    venue: 'Centro de Eventos Explanada',
    date: '2026-01-31',
    scheduleStart: '22:00',
    scheduleEnd: '05:00',
    openingTime: '22:00',
    closingTime: '05:00',
    categoryTone: 'party',
    producer: 'Caribe Events',
    producers: 'Ricardo Méndez / Alejandro Guzmán',
    capacity: 2500,
    address: 'Av. Winston Churchill 1099, Santo Domingo',
    posterUrl:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Alejandro Rojas', phone: '+56 9 8756 4321', initials: 'AR' },
      { id: '2', name: 'Valentina Muñoz', phone: '+56 9 6543 2109', initials: 'VM' },
    ],
    ...buildCaribeNightSales(2500),
  },
  {
    id: 'sunset-sessions',
    title: 'Sunset Sessions',
    displayTitle: 'Sunset Sessions 2026',
    venue: 'Candelaria',
    date: '2026-01-24',
    scheduleStart: '20:00',
    scheduleEnd: '01:00',
    openingTime: '20:00',
    closingTime: '01:00',
    categoryTone: 'concert',
    producer: 'Street Music',
    producers: 'Lucía Fernández / Mateo Reyes',
    capacity: 3500,
    address: 'Calle Candelaria 900, Santiago',
    posterUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=240&q=80',
    contacts: [
      { id: '1', name: 'Lucía Fernández', phone: '+56 9 8123 4567', initials: 'LF' },
      { id: '2', name: 'Mateo Reyes', phone: '+56 9 7654 3210', initials: 'MR' },
    ],
    ...defaultSales(3500),
  },
  {
    id: 'summer-vibes',
    title: 'Summer Vibes',
    displayTitle: 'Summer Vibes 2026',
    venue: 'Club Hipico Santiago',
    date: '2026-02-05',
    scheduleStart: '16:00',
    scheduleEnd: '23:00',
    openingTime: '16:00',
    closingTime: '23:00',
    categoryTone: 'festival',
    producer: 'Vibes Producciones',
    producers: 'María López / Tomás Vega',
    capacity: 8000,
    address: 'Av. Blanco Encalada 2540, Santiago',
    posterUrl:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'María López', phone: '+56 9 9012 3456', initials: 'ML' },
      { id: '2', name: 'Tomás Vega', phone: '+56 9 8877 1122', initials: 'TV' },
    ],
    ...defaultSales(8000),
  },
  {
    id: 'neon-party',
    title: 'Neon Party',
    displayTitle: 'Neon Party 2026',
    venue: 'Arena Monticello',
    date: '2026-02-07',
    scheduleStart: '23:30',
    scheduleEnd: '05:00',
    openingTime: '23:30',
    closingTime: '05:00',
    categoryTone: 'party',
    producer: 'Neon Live',
    producers: 'Andrea Silva / Pablo Núñez',
    capacity: 6000,
    address: 'Camino Las Flores 14000, Mostazal',
    posterUrl:
      'https://images.unsplash.com/photo-1571266027947-6a292129b066?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Andrea Silva', phone: '+56 9 7333 8899', initials: 'AS' },
      { id: '2', name: 'Pablo Núñez', phone: '+56 9 7444 5566', initials: 'PN' },
    ],
    ...defaultSales(6000),
  },
  {
    id: 'urban-beats',
    title: 'Urban Beats',
    displayTitle: 'Urban Beats 2026',
    venue: 'Teatro Caupolicán',
    date: '2026-01-04',
    scheduleStart: '20:00',
    scheduleEnd: '02:00',
    openingTime: '20:00',
    closingTime: '02:00',
    categoryTone: 'festival',
    producer: 'Black Events',
    producers: 'Camila Rojas / Diego Ortiz',
    capacity: 5000,
    address: 'Av. Parque O\'Higgins s/n, Santiago',
    posterUrl:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=240&q=80',
    contacts: [
      { id: '1', name: 'Camila Rojas', phone: '+56 9 6222 3344', initials: 'CR' },
      { id: '2', name: 'Diego Ortiz', phone: '+56 9 6111 7788', initials: 'DO' },
    ],
    ...defaultSales(5000),
  },
  {
    id: 'winter-groove',
    title: 'Winter Groove',
    displayTitle: 'Winter Groove 2026',
    venue: 'Espacio Riesco',
    date: '2026-01-31',
    scheduleStart: '21:00',
    scheduleEnd: '03:00',
    openingTime: '21:00',
    closingTime: '03:00',
    categoryTone: 'concert',
    producer: 'YouFest',
    producers: 'Ricardo Méndez / Alejandro Guzmán',
    capacity: 7500,
    address: 'Av. El Salto 5000, Huechuraba',
    posterUrl:
      'https://images.unsplash.com/photo-1459740669253-aa79f98232a0?auto=format&fit=crop&w=240&q=80',
    contacts: [
      { id: '1', name: 'Ricardo Méndez', phone: '+56 9 8555 1212', initials: 'RM' },
      { id: '2', name: 'Alejandro Guzmán', phone: '+56 9 8666 3434', initials: 'AG' },
    ],
    ...defaultSales(7500),
  },
  {
    id: 'latin-fire',
    title: 'Latin Fire',
    displayTitle: 'Latin Fire 2026',
    venue: 'Movistar Arena',
    date: '2026-02-12',
    scheduleStart: '21:00',
    scheduleEnd: '02:00',
    openingTime: '21:00',
    closingTime: '02:00',
    categoryTone: 'concert',
    producer: 'Latin Sounds',
    producers: 'Daniela Castro / Felipe Morales',
    capacity: 12000,
    address: 'Parque O\'Higgins s/n, Santiago',
    posterUrl:
      'https://images.unsplash.com/photo-1540039155733-5bb30b4cc179?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Daniela Castro', phone: '+56 9 9123 7788', initials: 'DC' },
      { id: '2', name: 'Felipe Morales', phone: '+56 9 9234 8899', initials: 'FM' },
    ],
    ...defaultSales(12000),
  },
  {
    id: 'electro-wave',
    title: 'Electro Wave',
    displayTitle: 'Electro Wave 2026',
    venue: 'Club La Feria',
    date: '2026-02-14',
    scheduleStart: '23:00',
    scheduleEnd: '06:00',
    openingTime: '23:00',
    closingTime: '06:00',
    categoryTone: 'party',
    producer: 'Wave Collective',
    producers: 'Sofía Herrera / Nicolás Paredes',
    capacity: 2200,
    address: 'Av. Vitacura 5959, Vitacura',
    posterUrl:
      'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Sofía Herrera', phone: '+56 9 9345 9900', initials: 'SH' },
      { id: '2', name: 'Nicolás Paredes', phone: '+56 9 9456 1010', initials: 'NP' },
    ],
    ...defaultSales(2200),
  },
  {
    id: 'jazz-nights',
    title: 'Jazz Nights',
    displayTitle: 'Jazz Nights 2026',
    venue: 'Teatro Nescafé de las Artes',
    date: '2026-02-18',
    scheduleStart: '20:30',
    scheduleEnd: '00:30',
    openingTime: '20:30',
    closingTime: '00:30',
    categoryTone: 'concert',
    producer: 'Blue Note Chile',
    producers: 'Patricia Lagos / Ernesto Fuentes',
    capacity: 1800,
    address: 'Av. Bustamante 50, Providencia',
    posterUrl:
      'https://images.unsplash.com/photo-1415201364774-f6f0ff35a28c?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Patricia Lagos', phone: '+56 9 9567 2121', initials: 'PL' },
      { id: '2', name: 'Ernesto Fuentes', phone: '+56 9 9678 3232', initials: 'EF' },
    ],
    ...defaultSales(1800),
  },
  {
    id: 'rooftop-sounds',
    title: 'Rooftop Sounds',
    displayTitle: 'Rooftop Sounds 2026',
    venue: 'W Santiago Rooftop',
    date: '2026-02-22',
    scheduleStart: '19:00',
    scheduleEnd: '01:00',
    openingTime: '19:00',
    closingTime: '01:00',
    categoryTone: 'festival',
    producer: 'Skyline Events',
    producers: 'Camila Rojas / Ignacio Bravo',
    capacity: 900,
    address: 'Isidora Goyenechea 3000, Las Condes',
    posterUrl:
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Camila Rojas', phone: '+56 9 9789 4343', initials: 'CR' },
      { id: '2', name: 'Ignacio Bravo', phone: '+56 9 9890 5454', initials: 'IB' },
    ],
    ...defaultSales(900),
  },
  {
    id: 'reggaeton-fest',
    title: 'Reggaeton Fest',
    displayTitle: 'Reggaeton Fest 2026',
    venue: 'Parque O\'Higgins',
    date: '2026-02-28',
    scheduleStart: '18:00',
    scheduleEnd: '23:59',
    openingTime: '18:00',
    closingTime: '23:59',
    categoryTone: 'festival',
    producer: 'Urban Pulse',
    producers: 'Valentina Muñoz / Diego Ortiz',
    capacity: 15000,
    address: 'Av. Parque O\'Higgins s/n, Santiago',
    posterUrl:
      'https://images.unsplash.com/photo-1501281668745-f7ba57915525?auto=format&fit=crop&w=640&q=80',
    contacts: [
      { id: '1', name: 'Valentina Muñoz', phone: '+56 9 9901 6565', initials: 'VM' },
      { id: '2', name: 'Diego Ortiz', phone: '+56 9 9012 7676', initials: 'DO' },
    ],
    ...defaultSales(15000),
  },
];

export function getProducerEvent(eventId: string) {
  return producerEventCatalog.find((event) => event.id === eventId) ?? null;
}

export function toCalendarEventListItem(event: ProducerEvent) {
  return {
    id: event.id,
    title: event.title,
    venue: event.venue,
    date: event.date,
    scheduleStart: event.scheduleStart,
    scheduleEnd: event.scheduleEnd,
    categoryTone: event.categoryTone,
    producer: event.producer,
    producers: event.producers,
    capacity: event.capacity,
    address: event.address,
  };
}

export const producerCalendarEvents = producerEventCatalog.map(toCalendarEventListItem);
