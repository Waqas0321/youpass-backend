import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';

export const configService = {
  async listCountries() {
    return prisma.country.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        code: true,
        name: true,
        dialCode: true,
        flagEmoji: true,
        currencyCode: true,
        languageCode: true,
        paymentGateway: true,
      },
    });
  },

  async getCurrency(countryCode: string) {
    const country = await prisma.country.findFirst({
      where: { code: countryCode.toUpperCase(), isActive: true },
    });
    if (!country) {
      throw new AppError(404, 'COUNTRY_NOT_FOUND', 'Country not supported');
    }
    return {
      country_code: country.code,
      currency_code: country.currencyCode,
      currency_symbol: country.currencySymbol,
      decimals: country.currencyDecimals,
    };
  },

  async getLanguage(countryCode: string) {
    const country = await prisma.country.findFirst({
      where: { code: countryCode.toUpperCase(), isActive: true },
    });
    if (!country) {
      throw new AppError(404, 'COUNTRY_NOT_FOUND', 'Country not supported');
    }
    return {
      country_code: country.code,
      language_code: country.languageCode,
    };
  },

  async getPaymentGateway(countryCode: string) {
    const country = await prisma.country.findFirst({
      where: { code: countryCode.toUpperCase(), isActive: true },
    });
    if (!country) {
      throw new AppError(404, 'COUNTRY_NOT_FOUND', 'Country not supported');
    }
    return {
      country_code: country.code,
      payment_gateway: country.paymentGateway,
      currency_code: country.currencyCode,
    };
  },
};
