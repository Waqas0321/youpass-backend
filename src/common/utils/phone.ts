import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { prisma } from '../../config/database.js';
import { AppError } from '../errors/app-error.js';
import { AUTH_ERROR_CODES } from '../../config/constants.js';

export type ParsedPhone = {
  e164: string;
  countryCode: string;
  nationalNumber: string;
};

export async function parseAndValidatePhone(
  phone: string,
  countryCode: string,
): Promise<ParsedPhone> {
  const country = await prisma.country.findFirst({
    where: { code: countryCode.toUpperCase(), isActive: true },
  });

  if (!country) {
    throw new AppError(400, AUTH_ERROR_CODES.UNSUPPORTED_COUNTRY, 'YouPass aún no opera en este país');
  }

  const parsed = parsePhoneNumberFromString(phone, countryCode.toUpperCase() as CountryCode);

  if (!parsed?.isValid()) {
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_PHONE, 'Por favor ingresa un número válido');
  }

  if (parsed.country && parsed.country !== countryCode.toUpperCase()) {
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_PHONE, 'Revisa el formato de tu número');
  }

  return {
    e164: parsed.format('E.164'),
    countryCode: countryCode.toUpperCase(),
    nationalNumber: parsed.nationalNumber,
  };
}

export function formatPhoneDisplay(e164: string, countryCode: string): string {
  const parsed = parsePhoneNumberFromString(e164, countryCode as CountryCode);
  return parsed?.formatInternational() ?? e164;
}
