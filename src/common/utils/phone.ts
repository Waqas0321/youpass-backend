import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { prisma } from '../../config/database.js';
import { AppError } from '../errors/app-error.js';
import { AUTH_ERROR_CODES } from '../../config/constants.js';

const MIN_PHONE_DIGITS = 6;

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
    throw new AppError(
      400,
      AUTH_ERROR_CODES.UNSUPPORTED_COUNTRY,
      'YouPass does not operate in this country yet',
    );
  }

  const digitsOnly = phone.replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < MIN_PHONE_DIGITS) {
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_PHONE, 'Please enter a valid number');
  }

  const parsed = parsePhoneNumberFromString(phone, countryCode.toUpperCase() as CountryCode);

  if (!parsed?.isValid()) {
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_PHONE, 'Check your number format');
  }

  if (parsed.country && parsed.country !== countryCode.toUpperCase()) {
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_PHONE, 'Check your number format');
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
