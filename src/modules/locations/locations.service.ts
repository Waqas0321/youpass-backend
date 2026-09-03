import { AppError } from '../../common/errors/app-error.js';
import type { LocationSearchQuery } from './locations.validators.js';

export type LocationSearchResult = {
  id: string;
  label: string;
  subtitle: string | null;
  city: string;
  country: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
};

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  neighbourhood?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

type NominatimItem = {
  place_id?: number | string;
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
  name?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const ALLOWED_TYPES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'suburb',
  'neighbourhood',
  'neighborhood',
  'hamlet',
  'locality',
  'county',
  'state_district',
]);

const searchCache = new Map<string, { expiresAt: number; results: LocationSearchResult[] }>();

function cacheKey(input: LocationSearchQuery): string {
  return `${input.q.toLowerCase()}|${input.country_code ?? ''}|${input.limit}`;
}

function pickCity(address: NominatimAddress | undefined, fallback: string): string {
  return (
    address?.city?.trim() ||
    address?.town?.trim() ||
    address?.village?.trim() ||
    address?.municipality?.trim() ||
    address?.suburb?.trim() ||
    address?.neighbourhood?.trim() ||
    address?.county?.trim() ||
    fallback
  );
}

function buildSubtitle(address: NominatimAddress | undefined, city: string): string | null {
  if (!address) {
    return null;
  }

  const parts = [address.state?.trim(), address.country?.trim()].filter(
    (part): part is string => Boolean(part && part.toLowerCase() !== city.toLowerCase()),
  );

  return parts.length > 0 ? parts.join(', ') : null;
}

function mapNominatimItem(item: NominatimItem): LocationSearchResult | null {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const type = (item.type ?? '').toLowerCase();
  const placeClass = (item.class ?? '').toLowerCase();
  const isPlace =
    placeClass === 'place' ||
    placeClass === 'boundary' ||
    ALLOWED_TYPES.has(type);

  if (!isPlace && !ALLOWED_TYPES.has(type)) {
    return null;
  }

  const displayName = item.display_name?.trim() ?? '';
  const primaryName =
    item.name?.trim() ||
    displayName.split(',')[0]?.trim() ||
    '';

  if (!primaryName) {
    return null;
  }

  const city = pickCity(item.address, primaryName);
  const countryCode = item.address?.country_code?.trim().toUpperCase() ?? null;
  const osmKey = [item.osm_type, item.osm_id].filter(Boolean).join(':');
  const id = osmKey || `nominatim:${item.place_id ?? `${latitude},${longitude}`}`;

  return {
    id,
    label: primaryName,
    subtitle: buildSubtitle(item.address, city),
    city,
    country: item.address?.country?.trim() ?? null,
    country_code: countryCode,
    latitude,
    longitude,
  };
}

export const locationsService = {
  async search(input: LocationSearchQuery): Promise<LocationSearchResult[]> {
    const key = cacheKey(input);
    const cached = searchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results;
    }

    const params = new URLSearchParams({
      q: input.q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(Math.min(input.limit * 2, 20)),
    });

    // Optional hard filter — omit for worldwide city/place search.
    if (input.country_code) {
      params.set('countrycodes', input.country_code.toLowerCase());
    }

    let response: Response;
    try {
      response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'YouPassBackend/1.0 (location-search; https://youpass.app)',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new AppError(502, 'LOCATION_SEARCH_UNAVAILABLE', 'Location search is temporarily unavailable');
    }

    if (!response.ok) {
      throw new AppError(502, 'LOCATION_SEARCH_FAILED', 'Location search failed');
    }

    const payload = (await response.json()) as NominatimItem[];
    const seen = new Set<string>();
    const results: LocationSearchResult[] = [];

    for (const item of payload) {
      const mapped = mapNominatimItem(item);
      if (!mapped) {
        continue;
      }

      const dedupeKey = `${mapped.label.toLowerCase()}|${mapped.country_code ?? ''}|${mapped.latitude.toFixed(3)}|${mapped.longitude.toFixed(3)}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      results.push(mapped);

      if (results.length >= input.limit) {
        break;
      }
    }

    searchCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results });
    return results;
  },
};
