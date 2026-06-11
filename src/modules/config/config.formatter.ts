import type { Country } from '@prisma/client';

/** Public country row for Flutter — supports camelCase and snake_case field names. */
export function formatCountryConfig(country: Country) {
  const dial = country.dialCode.replace(/^\+/, '');
  return {
    code: country.code,
    name: country.name,
    dialCode: dial,
    dial_code: dial,
    flagEmoji: country.flagEmoji,
    flag_emoji: country.flagEmoji,
    phoneHint: country.phoneHint ?? null,
    phone_hint: country.phoneHint ?? null,
    defaultLanguage: country.languageCode,
    default_language: country.languageCode,
    defaultCurrency: country.currencyCode,
    default_currency: country.currencyCode,
    currencyCode: country.currencyCode,
    currency_code: country.currencyCode,
    currencySymbol: country.currencySymbol,
    currency_symbol: country.currencySymbol,
    currencyDecimals: country.currencyDecimals,
    currency_decimals: country.currencyDecimals,
    languageCode: country.languageCode,
    language_code: country.languageCode,
    timezone: country.timezone,
    paymentGateway: country.paymentGateway,
    payment_gateway: country.paymentGateway,
    isActive: country.isActive,
    is_active: country.isActive,
    sortOrder: country.displayOrder,
    sort_order: country.displayOrder,
  };
}
