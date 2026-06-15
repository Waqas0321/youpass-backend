import { prisma } from '../../config/database.js';
import {
  getActiveCountry,
  listActiveCountries,
  warmCountryCache,
} from '../../common/services/country-config.service.js';
import { formatCountryConfig } from './config.formatter.js';
import {
  getSecurityPolicy,
  getAuthConfigBundle,
} from '../../common/services/security-policy.service.js';

export const configService = {
  async listCountries() {
    const countries = await listActiveCountries();
    return countries.map(formatCountryConfig);
  },

  async getAppConfig() {
    await warmCountryCache();
    const countries = await this.listCountries();
    const languages = [...new Set(countries.map((c) => c.defaultLanguage))].sort();

    return {
      defaultCountryCode: countries[0]?.code ?? 'CL',
      default_country_code: countries[0]?.code ?? 'CL',
      supportedLanguages: languages,
      supported_languages: languages,
      ...getAuthConfigBundle(),
      countries,
    };
  },

  getAuthConfig(languageCode = 'es') {
    return getAuthConfigBundle(languageCode);
  },

  getSecurityConfig() {
    return getSecurityPolicy();
  },

  async getBrowseCategories() {
    const eventTypes = await prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return eventTypes.map((type) => ({
      id: type.slug,
      label: type.name,
      eventTypeSlug: type.slug,
      event_type_slug: type.slug,
      icon: type.icon,
    }));
  },

  async getHomeCategories(selectedCountryCode?: string) {
    const [countries, eventTypes] = await Promise.all([
      listActiveCountries(),
      prisma.eventType.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const normalizedCode = selectedCountryCode?.toUpperCase();
    const selected =
      (normalizedCode ? countries.find((c) => c.code === normalizedCode) : null) ??
      countries[0] ??
      null;

    return {
      selected_country_code: selected?.code ?? null,
      country: selected
        ? {
            code: selected.code,
            label: selected.name.toUpperCase(),
            name: selected.name,
            flag_emoji: selected.flagEmoji,
            prefix_icon: '📍',
          }
        : null,
      event_types: eventTypes.map((type) => ({
        id: type.id,
        slug: type.slug,
        name: type.name,
        label: type.name,
        icon: type.icon,
      })),
      scrollable: true,
    };
  },

  async getCurrency(countryCode: string) {
    const country = await getActiveCountry(countryCode);
    return {
      country_code: country.code,
      currency_code: country.currencyCode,
      currency_symbol: country.currencySymbol,
      decimals: country.currencyDecimals,
    };
  },

  async getLanguage(countryCode: string) {
    const country = await getActiveCountry(countryCode);
    return {
      country_code: country.code,
      language_code: country.languageCode,
    };
  },

  async getPaymentGateway(countryCode: string) {
    const country = await getActiveCountry(countryCode);
    return {
      country_code: country.code,
      payment_gateway: country.paymentGateway,
      currency_code: country.currencyCode,
    };
  },
};
