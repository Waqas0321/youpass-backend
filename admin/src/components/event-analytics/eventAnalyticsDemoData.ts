import type { AdminEventDashboard } from '../../api/client';
import type { AnalyticsRank, AnalyticsSlice } from './buildEventAnalyticsView';

/** Design-only placeholders for charts/ranks when real analytics data is empty. KPIs always use live dashboard data. */
export const ANALYTICS_USE_DEMO_FALLBACKS = false;

type DemoBundle = {
  consumptionByCategory: AnalyticsSlice[];
  revenueByZone: AnalyticsSlice[];
  paymentMethods: AnalyticsSlice[];
  ticketsByType: AnalyticsSlice[];
  topProducts: AnalyticsRank[];
  topTickets: AnalyticsRank[];
  vipUsers: AnalyticsRank[];
};

const DEMO_ES: DemoBundle = {
  ticketsByType: [
    { label: 'General + Cover', value: 3944 },
    { label: 'VIP General', value: 2191 },
    { label: 'VIP DJ', value: 1315 },
    { label: 'Mesa VIP', value: 876 },
    { label: 'Cortesias', value: 438 },
  ],
  consumptionByCategory: [
    { label: 'Piscina', value: 5545 },
    { label: 'Gin', value: 3168 },
    { label: 'Cervezas', value: 3168 },
    { label: 'Energéticas', value: 1584 },
    { label: 'Espumantes', value: 1267 },
    { label: 'Agua & Bebidas', value: 1110 },
  ],
  revenueByZone: [
    { label: 'VIP DJ', value: 28_450_000 },
    { label: 'VIP 1', value: 21_900_000 },
    { label: 'VIP 2', value: 18_760_000 },
    { label: 'VIP 3', value: 12_900_000 },
    { label: 'Barra Principal', value: 8_250_000 },
    { label: 'Terraza', value: 5_230_000 },
    { label: 'Backstage', value: 2_970_000 },
  ],
  paymentMethods: [
    { label: 'Webpay', value: 45 },
    { label: 'Tarjeta de crédito', value: 30 },
    { label: 'Tarjeta de débito', value: 15 },
    { label: 'Transferencia', value: 5 },
    { label: 'Billeteras digitales', value: 5 },
  ],
  topProducts: [
    { name: 'Pisco Sour', count: 1852 },
    { name: 'Gin Tonic', count: 1432 },
    { name: 'Red Bull', count: 1108 },
    { name: 'Piscola', count: 1024 },
    { name: 'Corona', count: 890 },
  ],
  topTickets: [
    { name: 'General + Cover', count: 3852 },
    { name: 'VIP General', count: 1872 },
    { name: 'VIP DJ', count: 1263 },
    { name: 'Mesa VIP', count: 856 },
    { name: 'Cortesías', count: 848 },
  ],
  vipUsers: [
    { name: 'Camila Méndez', count: 24 },
    { name: 'Rodrigo Valdés', count: 22 },
    { name: 'Javier Rojas', count: 18 },
    { name: 'Valentina Torres', count: 17 },
    { name: 'Diego Fernández', count: 15 },
  ],
};

const DEMO_EN: DemoBundle = {
  ticketsByType: [
    { label: 'General + Cover', value: 3944 },
    { label: 'VIP General', value: 2191 },
    { label: 'VIP DJ', value: 1315 },
    { label: 'VIP Table', value: 876 },
    { label: 'Complimentary', value: 438 },
  ],
  consumptionByCategory: [
    { label: 'Pool drinks', value: 5545 },
    { label: 'Gin', value: 3168 },
    { label: 'Beers', value: 3168 },
    { label: 'Energy drinks', value: 1584 },
    { label: 'Sparkling wine', value: 1267 },
    { label: 'Water & soft drinks', value: 1110 },
  ],
  revenueByZone: [
    { label: 'VIP DJ', value: 28_450_000 },
    { label: 'VIP 1', value: 21_900_000 },
    { label: 'VIP 2', value: 18_760_000 },
    { label: 'VIP 3', value: 12_900_000 },
    { label: 'Main bar', value: 8_250_000 },
    { label: 'Terrace', value: 5_230_000 },
    { label: 'Backstage', value: 2_970_000 },
  ],
  paymentMethods: [
    { label: 'Webpay', value: 45 },
    { label: 'Credit card', value: 30 },
    { label: 'Debit card', value: 15 },
    { label: 'Bank transfer', value: 5 },
    { label: 'Digital wallets', value: 5 },
  ],
  topProducts: [
    { name: 'Pisco Sour', count: 1852 },
    { name: 'Gin Tonic', count: 1432 },
    { name: 'Red Bull', count: 1108 },
    { name: 'Piscola', count: 1024 },
    { name: 'Corona', count: 890 },
  ],
  topTickets: [
    { name: 'General + Cover', count: 3852 },
    { name: 'VIP General', count: 1872 },
    { name: 'VIP DJ', count: 1263 },
    { name: 'VIP Table', count: 856 },
    { name: 'Complimentary', count: 848 },
  ],
  vipUsers: DEMO_ES.vipUsers,
};

export function getAnalyticsDemoBundle(locale: string): DemoBundle {
  return locale.startsWith('es') ? DEMO_ES : DEMO_EN;
}

function buildDemoHourlyRevenueCurve() {
  const curve: Record<number, number> = {
    12: 800_000,
    13: 1_200_000,
    14: 1_800_000,
    15: 2_400_000,
    16: 3_500_000,
    17: 4_800_000,
    18: 6_200_000,
    19: 7_800_000,
    20: 9_000_000,
    21: 10_000_000,
    22: 9_500_000,
    23: 8_000_000,
    0: 6_500_000,
    1: 5_000_000,
    2: 3_800_000,
    3: 2_800_000,
    4: 1_900_000,
    5: 1_200_000,
    6: 600_000,
  };

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    value: curve[hour] ?? 0,
  }));
}

export function getDemoHourlyRevenueCurve() {
  return buildDemoHourlyRevenueCurve();
}

function buildDemoHourlyBucket() {
  const curve: Record<number, number> = {
    12: 1,
    13: 2,
    14: 3,
    15: 4,
    16: 5,
    17: 6,
    18: 7,
    19: 8,
    20: 9,
    21: 10,
    22: 9,
    23: 7,
    0: 6,
    1: 5,
    2: 4,
    3: 3,
    4: 2,
    5: 1,
    6: 1,
  };

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    value: curve[hour] ?? 0,
  }));
}

export function getDemoHourlyByPeriod(): AdminEventDashboard['hourly_ticket_sales_by_period'] {
  const hourly = buildDemoHourlyBucket();
  return {
    today: hourly,
    yesterday: hourly.map((point) => ({ ...point, value: Math.max(0, point.value - 2) })),
    last_7_days: hourly,
    all_time: hourly,
  };
}

export function withDemoSlices(real: AnalyticsSlice[], demo: AnalyticsSlice[]) {
  if (!ANALYTICS_USE_DEMO_FALLBACKS || real.length > 0) {
    return real;
  }
  return demo;
}

export function withDemoRanks(real: AnalyticsRank[], demo: AnalyticsRank[]) {
  if (!ANALYTICS_USE_DEMO_FALLBACKS || real.length > 0) {
    return real;
  }
  return demo;
}

export function withDemoDelta(real: number, demo: number) {
  if (!ANALYTICS_USE_DEMO_FALLBACKS || real !== 0) {
    return real;
  }
  return demo;
}

export function withDemoNumber(real: number, demo: number) {
  if (!ANALYTICS_USE_DEMO_FALLBACKS || real > 0) {
    return real;
  }
  return demo;
}

export function withDemoHourlyByPeriod(
  real: AdminEventDashboard['hourly_ticket_sales_by_period'],
) {
  if (!ANALYTICS_USE_DEMO_FALLBACKS) {
    return real;
  }

  const allTime = real.all_time ?? [];
  const total = allTime.reduce((sum, point) => sum + point.value, 0);
  if (total > 0) {
    return real;
  }

  return getDemoHourlyByPeriod();
}

export type DemoBehavior = {
  peakEntryHour: string;
  peakEntryDeltaPct: number;
  peakEntryCurve: number[];
  peakConsumptionHour: string;
  peakConsumptionDeltaPct: number;
  peakConsumptionCurve: number[];
  recurringUsers: number;
  recurringSharePct: number;
  recurringDeltaPct: number;
  recurringCurve: number[];
  socialConversionPct: number;
  socialDeltaPct: number;
  socialCurve: number[];
};

const DEMO_BEHAVIOR: DemoBehavior = {
  peakEntryHour: '23:15',
  peakEntryDeltaPct: 12,
  peakEntryCurve: [42, 38, 36, 40, 48, 55, 62, 70, 78, 84, 90, 88, 74, 68, 72, 80, 96, 88],
  peakConsumptionHour: '01:05',
  peakConsumptionDeltaPct: 14,
  peakConsumptionCurve: [28, 32, 30, 36, 42, 48, 52, 50, 56, 62, 68, 74, 82, 92, 86, 78, 72, 66],
  recurringUsers: 3210,
  recurringSharePct: 25,
  recurringDeltaPct: 8.4,
  recurringCurve: [22, 26, 24, 28, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 82, 76],
  socialConversionPct: 32.7,
  socialDeltaPct: 6.2,
  socialCurve: [18, 22, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 70],
};

export function getDemoBehavior(): DemoBehavior {
  return DEMO_BEHAVIOR;
}
