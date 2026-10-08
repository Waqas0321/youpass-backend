/**
 * Full WhatsApp OTP E2E (no autofill / no API-returned OTP):
 * 1) Create AuthCode in DB with known hash
 * 2) Deliver same code via live Meta WhatsApp template
 * 3) Verify via production API (verify-code → register)
 *
 * Usage:
 *   npx tsx scripts/test-auth-whatsapp-otp-full-e2e.ts
 *   npx tsx scripts/test-auth-whatsapp-otp-full-e2e.ts +923205905161
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { generateOtp, hashOtp } from '../src/common/utils/crypto.js';
import { metaOtpTemplateLanguage } from '../src/config/meta-whatsapp.config.js';
import { sendMetaWhatsAppOtp } from '../src/modules/messaging/meta-whatsapp.service.js';

const API =
  process.env.API_BASE?.replace(/\/$/, '') ??
  'https://youpass-backend-two.vercel.app/api/v1';

const phoneE164 = (process.argv[2] ?? '+923205905161').trim();
const national = phoneE164.replace(/^\+92/, '');
const countryCode = 'PK';
const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json };
}

async function main(): Promise<void> {
  const templateName = env.WHATSAPP_OTP_TEMPLATE_NAME.trim() || 'youpass_otp';
  const languageCode = metaOtpTemplateLanguage('en');
  const code = generateOtp(env.OTP_LENGTH || 6);
  const codeHash = await hashOtp(code);
  const expiresAt = addMinutes(new Date(), env.OTP_TTL_MINUTES || 3);

  console.log('=== WhatsApp OTP full E2E ===');
  console.log(`API:      ${API}`);
  console.log(`Phone:    ${phoneE164}`);
  console.log(`Template: ${templateName} (${languageCode})`);
  console.log(`OTP:      ${code} (also delivered on WhatsApp — enter manually in app)`);

  await prisma.authCode.updateMany({
    where: {
      phone: phoneE164,
      purpose: 'register',
      OR: [{ usedAt: null }, { usedAt: { isSet: false } }],
    },
    data: { usedAt: new Date() },
  });

  await prisma.authCode.create({
    data: {
      phone: phoneE164,
      codeHash,
      purpose: 'register',
      countryCode,
      expiresAt,
      sentVia: 'whatsapp',
      whatsappTemplate: templateName,
    },
  });
  console.log('1) AuthCode stored (hashed)');

  const meta = await sendMetaWhatsAppOtp({
    toE164: phoneE164,
    templateName,
    languageCode,
    code,
  });
  console.log('2) Meta WhatsApp accepted:', meta.messageId);

  const verify = await api('/auth/verify-code', {
    phone: national,
    country_code: countryCode,
    code,
    purpose: 'register',
  });
  console.log('3) verify-code:', verify.status, JSON.stringify(verify.json));
  if (verify.status >= 400 || !verify.json.success) {
    process.exit(1);
  }

  // Clean up any prior partial user for this phone so register is idempotent in E2E.
  const existing = await prisma.user.findUnique({ where: { phone: phoneE164 } });
  if (existing) {
    console.log('User already exists — login path instead of register');
    await prisma.authCode.updateMany({
      where: {
        phone: phoneE164,
        purpose: 'login',
        OR: [{ usedAt: null }, { usedAt: { isSet: false } }],
      },
      data: { usedAt: new Date() },
    });
    const loginHash = await hashOtp(code);
    await prisma.authCode.create({
      data: {
        phone: phoneE164,
        codeHash: loginHash,
        purpose: 'login',
        countryCode,
        expiresAt: addMinutes(new Date(), 3),
        sentVia: 'whatsapp',
        whatsappTemplate: templateName,
      },
    });
    const login = await api('/auth/login', {
      phone: national,
      country_code: countryCode,
      code,
    });
    console.log('4) login:', login.status, JSON.stringify(login.json));
    if (login.status >= 400 || !login.json.success) process.exit(1);
  } else {
    const register = await api('/auth/register', {
      phone: national,
      country_code: countryCode,
      code,
      full_name: 'WhatsApp E2E User',
      rut_or_passport: `E2E${Date.now().toString().slice(-8)}`,
      email: `whatsapp.e2e.${Date.now()}@youpass.test`,
      birthdate: '1995-06-15',
      gender: 'other',
      accept_terms: true,
      preferred_language: 'en',
    });
    console.log('4) register:', register.status, JSON.stringify(register.json));
    if (register.status >= 400 || !register.json.success) {
      process.exit(1);
    }
  }

  console.log('');
  console.log('PASS: WhatsApp OTP delivered + verified (no autofill / no dev_otp_code).');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
