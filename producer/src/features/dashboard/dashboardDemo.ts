import type { GenderId } from '../../i18n/localize';
import type { EventCategoryTone } from '../events/types';
import type { TicketCategoryId } from '../events/types';

export type ProducerBarItem = {
  id: string;
  initials: string;
  value: number;
  max: number;
  color: string;
};

export type CalendarEventItem = {
  id: string;
  title: string;
  producer: string;
  date: string;
  venue: string;
  time: string;
  categoryTone: EventCategoryTone;
  imageUrl: string;
};

export type GenderSlice = {
  id: GenderId;
  value: number;
  color: string;
};

export type TicketSlice = {
  id: TicketCategoryId;
  count: number;
  color: string;
};

export type TicketSalesEvent = {
  id: string;
  title: string;
  producer: string;
  capacity: number;
  sold: number;
  soldPct: number;
  slices: TicketSlice[];
};

export type SparkPoint = {
  date: string;
  value: number;
};

export type FeaturedEvent = {
  id: string;
  title: string;
  imageUrl: string;
  venue: string;
  date: string;
  categoryTone: EventCategoryTone;
  producer: string;
  capacity: number;
  status: 'active' | 'draft';
};

export type ProducerDashboardData = {
  dateRangeStart: string;
  dateRangeEnd: string;
  activeEventsByProducer: ProducerBarItem[];
  registeredUsers: {
    total: number;
    deltaPct: number;
    newLast30Days: number;
    trend: SparkPoint[];
  };
  calendarEvents: CalendarEventItem[];
  genderSlices: GenderSlice[];
  ageGroups: ProducerBarItem[];
  countries: ProducerBarItem[];
  cities: ProducerBarItem[];
  ticketSales: TicketSalesEvent[];
  featuredEvents: FeaturedEvent[];
};

const TICKET_COLORS = {
  general: '#a855f7',
  vip: '#22c55e',
  vipTable: '#ffb800',
  backstage: '#ec4899',
};

export const producerDashboardDemo: ProducerDashboardData = {
  dateRangeStart: '2026-01-25',
  dateRangeEnd: '2026-01-31',
  activeEventsByProducer: [
    { id: 'youfest', initials: 'YF', value: 8, max: 8, color: '#a855f7' },
    { id: 'lotus', initials: 'LP', value: 6, max: 8, color: '#f97316' },
    { id: 'street-music', initials: 'SM', value: 4, max: 8, color: '#22c55e' },
    { id: 'club-57', initials: 'C5', value: 3, max: 8, color: '#3b82f6' },
    { id: 'black-events', initials: 'BE', value: 2, max: 8, color: '#ec4899' },
  ],
  registeredUsers: {
    total: 84592,
    deltaPct: 12.4,
    newLast30Days: 12842,
    trend: [
      { date: '2025-12-25', value: 30000 },
      { date: '2025-12-28', value: 42000 },
      { date: '2026-01-01', value: 54000 },
      { date: '2026-01-08', value: 62000 },
      { date: '2026-01-15', value: 70000 },
      { date: '2026-01-22', value: 78000 },
      { date: '2026-01-31', value: 84592 },
    ],
  },
  calendarEvents: [
    {
      id: '1',
      title: 'Caribe Night',
      producer: 'YouFest',
      date: '2026-01-31',
      venue: 'Centro de Eventos Explanada',
      time: '18:00',
      categoryTone: 'concert',
      imageUrl:
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '2',
      title: 'Summer Vibes',
      producer: 'Lotus Producciones',
      date: '2026-02-02',
      venue: 'Parque O\'Higgins',
      time: '16:00',
      categoryTone: 'festival',
      imageUrl:
        'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '3',
      title: 'Neon Party',
      producer: 'Club 57',
      date: '2026-02-05',
      venue: 'Blondie',
      time: '23:30',
      categoryTone: 'party',
      imageUrl:
        'https://images.unsplash.com/photo-1571266027947-6a292129b066?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '4',
      title: 'Sunset Sessions',
      producer: 'Street Music',
      date: '2026-02-08',
      venue: 'Candelaria',
      time: '20:00',
      categoryTone: 'concert',
      imageUrl:
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '5',
      title: 'Urban Beats',
      producer: 'Black Events',
      date: '2026-02-12',
      venue: 'Teatro Caupolicán',
      time: '21:00',
      categoryTone: 'festival',
      imageUrl:
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=120&q=80',
    },
  ],
  genderSlices: [
    { id: 'male', value: 55.2, color: '#a855f7' },
    { id: 'female', value: 43.1, color: '#ec4899' },
    { id: 'nonBinary', value: 1.7, color: '#ffb800' },
  ],
  ageGroups: [
    { id: '18-24', initials: '', value: 32.5, max: 40, color: '#a855f7' },
    { id: '25-34', initials: '', value: 38.7, max: 40, color: '#a855f7' },
    { id: '35-44', initials: '', value: 16.8, max: 40, color: '#a855f7' },
    { id: '45-54', initials: '', value: 8.9, max: 40, color: '#a855f7' },
    { id: '55+', initials: '', value: 3.1, max: 40, color: '#a855f7' },
  ],
  countries: [
    { id: 'chile', initials: '', value: 62.3, max: 70, color: '#a855f7' },
    { id: 'colombia', initials: '', value: 12.6, max: 70, color: '#a855f7' },
    { id: 'argentina', initials: '', value: 10.2, max: 70, color: '#a855f7' },
    { id: 'peru', initials: '', value: 5.6, max: 70, color: '#a855f7' },
    { id: 'mexico', initials: '', value: 3.2, max: 70, color: '#a855f7' },
    { id: 'other', initials: '', value: 6.1, max: 70, color: '#a855f7' },
  ],
  cities: [
    { id: 'santiago', initials: '', value: 48.7, max: 55, color: '#a855f7' },
    { id: 'bogota', initials: '', value: 8.9, max: 55, color: '#a855f7' },
    { id: 'buenos-aires', initials: '', value: 7.2, max: 55, color: '#a855f7' },
    { id: 'medellin', initials: '', value: 5.1, max: 55, color: '#a855f7' },
    { id: 'lima', initials: '', value: 4.3, max: 55, color: '#a855f7' },
  ],
  ticketSales: [
    {
      id: 'caribe-night',
      title: 'Caribe Night',
      producer: 'YouFest',
      capacity: 10000,
      sold: 7450,
      soldPct: 74.5,
      slices: [
        { id: 'general', count: 4020, color: TICKET_COLORS.general },
        { id: 'vip', count: 2100, color: TICKET_COLORS.vip },
        { id: 'vipTable', count: 960, color: TICKET_COLORS.vipTable },
        { id: 'backstage', count: 380, color: TICKET_COLORS.backstage },
      ],
    },
    {
      id: 'summer-vibes',
      title: 'Summer Vibes',
      producer: 'Lotus Producciones',
      capacity: 8000,
      sold: 5600,
      soldPct: 70,
      slices: [
        { id: 'general', count: 3010, color: TICKET_COLORS.general },
        { id: 'vip', count: 1580, color: TICKET_COLORS.vip },
        { id: 'vipTable', count: 720, color: TICKET_COLORS.vipTable },
        { id: 'backstage', count: 290, color: TICKET_COLORS.backstage },
      ],
    },
    {
      id: 'neon-party',
      title: 'Neon Party',
      producer: 'Club 57',
      capacity: 6000,
      sold: 3900,
      soldPct: 65,
      slices: [
        { id: 'general', count: 2260, color: TICKET_COLORS.general },
        { id: 'vip', count: 980, color: TICKET_COLORS.vip },
        { id: 'vipTable', count: 420, color: TICKET_COLORS.vipTable },
        { id: 'backstage', count: 240, color: TICKET_COLORS.backstage },
      ],
    },
  ],
  featuredEvents: [
    {
      id: 'caribe-night',
      title: 'Caribe Night',
      imageUrl:
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=640&q=80',
      venue: 'Centro de Eventos Explanada',
      date: '2026-01-31',
      categoryTone: 'concert',
      producer: 'YouFest',
      capacity: 10000,
      status: 'active',
    },
    {
      id: 'summer-vibes',
      title: 'Summer Vibes',
      imageUrl:
        'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=640&q=80',
      venue: 'Parque O\'Higgins',
      date: '2026-02-02',
      categoryTone: 'festival',
      producer: 'Lotus Producciones',
      capacity: 8000,
      status: 'active',
    },
    {
      id: 'neon-party',
      title: 'Neon Party',
      imageUrl:
        'https://images.unsplash.com/photo-1571266027947-6a292129b066?auto=format&fit=crop&w=640&q=80',
      venue: 'Blondie',
      date: '2026-02-05',
      categoryTone: 'party',
      producer: 'Club 57',
      capacity: 6000,
      status: 'active',
    },
  ],
};

export const PRODUCER_NAME_LABELS: Record<string, string> = {
  youfest: 'YouFest',
  lotus: 'Lotus Producciones',
  'street-music': 'Street Music',
  'club-57': 'Club 57',
  'black-events': 'Black Events',
};

export const CITY_LABELS: Record<string, string> = {
  santiago: 'Santiago',
  bogota: 'Bogotá',
  'buenos-aires': 'Buenos Aires',
  medellin: 'Medellín',
  lima: 'Lima',
};

export function producerBarLabel(id: string, fallback?: string) {
  return PRODUCER_NAME_LABELS[id] ?? CITY_LABELS[id] ?? fallback ?? id;
}
