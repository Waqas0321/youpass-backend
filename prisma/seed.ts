import { PrismaClient, PaymentGateway } from '@prisma/client';

const prisma = new PrismaClient();

type CountrySeed = {
  code: string;
  name: string;
  dialCode: string;
  flagEmoji: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  languageCode: string;
  paymentGateway: PaymentGateway;
  timezone: string;
  displayOrder: number;
};

const LATAM_COUNTRIES: CountrySeed[] = [
  { code: 'CL', name: 'Chile', dialCode: '+56', flagEmoji: '🇨🇱', currencyCode: 'CLP', currencySymbol: '$', currencyDecimals: 0, languageCode: 'es', paymentGateway: 'klap', timezone: 'America/Santiago', displayOrder: 1 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flagEmoji: '🇦🇷', currencyCode: 'ARS', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Argentina/Buenos_Aires', displayOrder: 2 },
  { code: 'MX', name: 'México', dialCode: '+52', flagEmoji: '🇲🇽', currencyCode: 'MXN', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Mexico_City', displayOrder: 3 },
  { code: 'PE', name: 'Perú', dialCode: '+51', flagEmoji: '🇵🇪', currencyCode: 'PEN', currencySymbol: 'S/', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Lima', displayOrder: 4 },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flagEmoji: '🇨🇴', currencyCode: 'COP', currencySymbol: '$', currencyDecimals: 0, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Bogota', displayOrder: 5 },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flagEmoji: '🇺🇾', currencyCode: 'UYU', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Montevideo', displayOrder: 6 },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flagEmoji: '🇵🇾', currencyCode: 'PYG', currencySymbol: '₲', currencyDecimals: 0, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Asuncion', displayOrder: 7 },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flagEmoji: '🇧🇴', currencyCode: 'BOB', currencySymbol: 'Bs.', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/La_Paz', displayOrder: 8 },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flagEmoji: '🇪🇨', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Guayaquil', displayOrder: 9 },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flagEmoji: '🇻🇪', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Caracas', displayOrder: 10 },
  { code: 'BR', name: 'Brasil', dialCode: '+55', flagEmoji: '🇧🇷', currencyCode: 'BRL', currencySymbol: 'R$', currencyDecimals: 2, languageCode: 'pt', paymentGateway: 'stripe', timezone: 'America/Sao_Paulo', displayOrder: 11 },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flagEmoji: '🇨🇷', currencyCode: 'CRC', currencySymbol: '₡', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Costa_Rica', displayOrder: 12 },
  { code: 'PA', name: 'Panamá', dialCode: '+507', flagEmoji: '🇵🇦', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Panama', displayOrder: 13 },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flagEmoji: '🇬🇹', currencyCode: 'GTQ', currencySymbol: 'Q', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Guatemala', displayOrder: 14 },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flagEmoji: '🇸🇻', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/El_Salvador', displayOrder: 15 },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flagEmoji: '🇭🇳', currencyCode: 'HNL', currencySymbol: 'L', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Tegucigalpa', displayOrder: 16 },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flagEmoji: '🇳🇮', currencyCode: 'NIO', currencySymbol: 'C$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Managua', displayOrder: 17 },
  { code: 'DO', name: 'República Dominicana', dialCode: '+1-809', flagEmoji: '🇩🇴', currencyCode: 'DOP', currencySymbol: '$', currencyDecimals: 2, languageCode: 'es', paymentGateway: 'stripe', timezone: 'America/Santo_Domingo', displayOrder: 18 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flagEmoji: '🇵🇰', currencyCode: 'PKR', currencySymbol: '₨', currencyDecimals: 2, languageCode: 'en', paymentGateway: 'stripe', timezone: 'Asia/Karachi', displayOrder: 19 },
];

async function main() {
  for (const country of LATAM_COUNTRIES) {
    const { code, ...data } = country;
    await prisma.country.upsert({
      where: { code },
      update: data,
      create: country,
    });
  }
  console.log(`Seeded ${LATAM_COUNTRIES.length} countries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
