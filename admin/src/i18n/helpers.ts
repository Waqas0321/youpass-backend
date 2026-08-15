import type { AdminTicketOffering } from '../api/client';

const OFFERING_TYPE_KEYS: Record<AdminTicketOffering['type'], string> = {
  early_bird: 'dashboard.categories.early_bird',
  preventa_2: 'dashboard.categories.preventa_2',
  preventa_3: 'dashboard.categories.preventa_3',
  general: 'dashboard.categories.general',
  vip_general: 'dashboard.categories.vip_general',
};

const FALLBACK_CATEGORY_KEYS = [
  'dashboard.categories.vip_general',
  'dashboard.categories.vip_dj',
  'dashboard.categories.preventa_1',
  'dashboard.categories.preventa_2',
  'dashboard.categories.general',
] as const;

const FALLBACK_CATEGORY_VALUES = [35, 25, 20, 15, 5] as const;

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function formatTodayDate(dateLocale: string, t: Translate) {
  const datePart = new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return t('dashboard.todayDate', { date: datePart });
}

export function localizeTicketOffering(offering: AdminTicketOffering, t: Translate) {
  const key = OFFERING_TYPE_KEYS[offering.type];
  if (key) {
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return offering.label?.trim() || offering.name?.trim() || t(key ?? 'dashboard.categories.general');
}

export function buildFallbackCategorySlices(t: Translate) {
  return FALLBACK_CATEGORY_KEYS.map((key, index) => ({
    label: t(key),
    value: FALLBACK_CATEGORY_VALUES[index],
  }));
}

export function buildCategorySlicesFromOfferings(offerings: AdminTicketOffering[], t: Translate) {
  if (offerings.length === 0) {
    return buildFallbackCategorySlices(t);
  }

  const slices = offerings.slice(0, 5).map((offering) => ({
    label: localizeTicketOffering(offering, t),
    value: Math.max(offering.sold_quantity ?? 0, 0),
  }));

  const totalSold = slices.reduce((sum, slice) => sum + slice.value, 0);
  const uniqueValues = new Set(slices.map((slice) => slice.value));

  if (totalSold === 0 || uniqueValues.size <= 1) {
    return buildFallbackCategorySlices(t);
  }

  return slices;
}
