import type { Country, PaymentGateway } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../errors/app-error.js';

export type CountryConfig = Country;

const cache = new Map<string, CountryConfig>();
let cacheLoaded = false;

export async function warmCountryCache(): Promise<void> {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
  cache.clear();
  for (const country of countries) {
    cache.set(country.code, country);
  }
  cacheLoaded = true;
}

async function ensureCache(): Promise<void> {
  if (!cacheLoaded) {
    await warmCountryCache();
  }
}

export async function getActiveCountry(code: string): Promise<CountryConfig> {
  await ensureCache();
  const country = cache.get(code.toUpperCase());
  if (!country) {
    throw new AppError(404, 'COUNTRY_NOT_FOUND', 'Country not supported');
  }
  return country;
}

export function getCountrySync(code: string): CountryConfig | undefined {
  return cache.get(code.toUpperCase());
}

export function getTimezone(countryCode: string): string {
  return getCountrySync(countryCode)?.timezone ?? 'UTC';
}

export function resolveGateway(countryCode: string): PaymentGateway {
  return getCountrySync(countryCode)?.paymentGateway ?? 'stripe';
}

export function getCurrencyForCountry(countryCode: string): string {
  return getCountrySync(countryCode)?.currencyCode ?? 'USD';
}

export function getEventCurrencyMeta(countryCode: string) {
  const country = getCountrySync(countryCode);
  return {
    country_code: countryCode.toUpperCase(),
    currency: country?.currencyCode ?? 'USD',
    currency_symbol: country?.currencySymbol ?? '$',
    currency_decimals: country?.currencyDecimals ?? 2,
    payment_gateway: country?.paymentGateway ?? 'stripe',
  };
}

export async function listActiveCountries(): Promise<CountryConfig[]> {
  await ensureCache();
  return [...cache.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function localeForLanguage(languageCode: string): string {
  switch (languageCode) {
    case 'pt':
      return 'pt-BR';
    case 'en':
      return 'en-US';
    default:
      return 'es-CL';
  }
}
