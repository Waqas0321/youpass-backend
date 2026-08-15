import { producerDashboardDemo } from '../dashboard/dashboardDemo';
import type { GenderSlice, ProducerBarItem } from '../dashboard/dashboardDemo';
import { getProducerEvent, producerEventCatalog } from '../events/eventCatalog';
import type { ProducerEvent } from '../events/types';

export const REPORTS_PAGE_DATE_RANGE = {
  start: '2026-01-25',
  end: '2026-01-31',
};

export const DEFAULT_REPORT_EVENT_ID = 'caribe-night';

const CARIBE_REPORT_TICKET_CATEGORIES = [
  { id: 'general' as const, sold: 990, total: 2100, color: '#a855f7' },
  { id: 'vip' as const, sold: 1000, total: 1500, color: '#22c55e' },
  { id: 'vipTable' as const, sold: 600, total: 900, color: '#ffb800' },
  { id: 'backstage' as const, sold: 250, total: 300, color: '#ec4899' },
];

export function getReportEventSnapshot(eventId: string): ProducerEvent | null {
  const base = getProducerEvent(eventId);
  if (!base) {
    return null;
  }

  if (eventId === 'caribe-night') {
    return {
      ...base,
      capacity: 2500,
      ticketsSold: 1875,
      salesStatus: 'active',
      ticketCategories: CARIBE_REPORT_TICKET_CATEGORIES,
    };
  }

  return base;
}

export type TopProduct = {
  id: string;
  name: string;
  unitsSold: number;
};

export type EventReportMetrics = {
  avgTicketClp: number;
  ticketRevenueClp: number;
  productRevenueClp: number;
  topProducts: TopProduct[];
  genderSlices: GenderSlice[];
  ageGroups: ProducerBarItem[];
};

const REPORT_METRICS: Record<string, EventReportMetrics> = {
  'caribe-night': {
    avgTicketClp: 32_450,
    ticketRevenueClp: 60_843_750,
    productRevenueClp: 18_456_300,
    topProducts: [
      { id: '1', name: 'Jäger Bomb', unitsSold: 1250 },
      { id: '2', name: 'Red Bull', unitsSold: 980 },
      { id: '3', name: 'Tropical Gin', unitsSold: 760 },
      { id: '4', name: 'Piscola', unitsSold: 620 },
      { id: '5', name: 'Agua con gas', unitsSold: 540 },
    ],
    genderSlices: producerDashboardDemo.genderSlices,
    ageGroups: producerDashboardDemo.ageGroups,
  },
};

function scaledMetrics(capacity: number, ticketsSold: number): EventReportMetrics {
  const ratio = ticketsSold / 1875;
  return {
    avgTicketClp: Math.round(32_450 * (0.85 + ratio * 0.15)),
    ticketRevenueClp: Math.round(ticketsSold * 32_450 * 0.98),
    productRevenueClp: Math.round(ticketsSold * 9_850 * (capacity / 2500)),
    topProducts: REPORT_METRICS['caribe-night'].topProducts.map((product, index) => ({
      ...product,
      unitsSold: Math.max(120, Math.round(product.unitsSold * ratio * (1 - index * 0.04))),
    })),
    genderSlices: producerDashboardDemo.genderSlices,
    ageGroups: producerDashboardDemo.ageGroups,
  };
}

export function getEventReportMetrics(eventId: string): EventReportMetrics {
  const preset = REPORT_METRICS[eventId];
  if (preset) {
    return preset;
  }

  const event = getProducerEvent(eventId);
  if (!event) {
    return REPORT_METRICS[DEFAULT_REPORT_EVENT_ID];
  }

  return scaledMetrics(event.capacity, event.ticketsSold);
}

export function resolveReportEventId(query: string, fallbackId = DEFAULT_REPORT_EVENT_ID) {
  const term = query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  if (!term) {
    return fallbackId;
  }

  const match = producerEventCatalog.find((event) => {
    const haystack = [event.title, event.producer, event.venue]
      .join(' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    return haystack.includes(term);
  });

  return match?.id ?? fallbackId;
}
