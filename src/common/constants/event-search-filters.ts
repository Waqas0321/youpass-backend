export const VENUE_KIND_OPTIONS = [
  { id: 'stadium', label: 'Stadium' },
  { id: 'club_nightclub', label: 'Club / Nightclub' },
  { id: 'theatre', label: 'Theatre' },
  { id: 'open_air', label: 'Open air' },
  { id: 'events_centre', label: 'Events centre' },
  { id: 'bar_restaurant', label: 'Bar / Restaurant' },
  { id: 'other', label: 'Other' },
] as const;

export const DATE_PRESET_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_weekend', label: 'This weekend' },
  { id: 'this_month', label: 'This month' },
  { id: 'custom', label: 'Custom range' },
] as const;

type CityOption = {
  id: string;
  label: string;
  zones?: string[];
};

const SEARCH_CITIES_BY_COUNTRY: Record<string, CityOption[]> = {
  CL: [
    {
      id: 'santiago',
      label: 'Santiago',
      zones: ['Las Condes', 'Providencia', 'Ñuñoa', 'Vitacura', 'Centro'],
    },
    { id: 'concepcion', label: 'Concepción' },
    { id: 'vina-del-mar', label: 'Viña del Mar' },
    { id: 'valparaiso', label: 'Valparaíso' },
    { id: 'antofagasta', label: 'Antofagasta' },
  ],
  CO: [{ id: 'bogota', label: 'Bogotá' }],
  MX: [{ id: 'ciudad-de-mexico', label: 'Ciudad de México' }],
  PE: [{ id: 'lima', label: 'Lima' }],
};

const DEFAULT_PRICE_RANGES: Record<string, { min: number; max: number; currency: string }> = {
  CL: { min: 0, max: 500000, currency: 'CLP' },
  CO: { min: 0, max: 500000, currency: 'COP' },
  MX: { min: 0, max: 5000, currency: 'MXN' },
  PE: { min: 0, max: 1000, currency: 'PEN' },
  PK: { min: 0, max: 50000, currency: 'PKR' },
  DEFAULT: { min: 0, max: 500000, currency: 'USD' },
};

export function getSearchCitiesForCountry(countryCode?: string) {
  if (!countryCode) {
    return [];
  }
  return SEARCH_CITIES_BY_COUNTRY[countryCode.toUpperCase()] ?? [];
}

export function getSearchPriceRange(countryCode?: string) {
  const code = countryCode?.toUpperCase() ?? 'DEFAULT';
  return DEFAULT_PRICE_RANGES[code] ?? DEFAULT_PRICE_RANGES.DEFAULT;
}

export function buildSearchFiltersConfig(countryCode?: string) {
  const priceRange = getSearchPriceRange(countryCode);
  return {
    date_presets: DATE_PRESET_OPTIONS,
    venue_types: VENUE_KIND_OPTIONS,
    cities: getSearchCitiesForCountry(countryCode),
    price_range: {
      min: priceRange.min,
      max: priceRange.max,
      currency: priceRange.currency,
      free_toggle_enabled: true,
    },
  };
}
