/**
 * Register a one-off test user for invite E2E testing.
 * Run: PORT=3002 npx tsx scripts/register-invite-test-user.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const port = process.env.PORT ?? '3000';
const API = `http://localhost:${port}/api/v1`;

const TEST_USER = {
  countryCode: 'CL',
  phone: '988777123',
  fullName: 'Invite Test Guest',
  rutOrPassport: 'INV-TEST-01',
  email: 'invite-test-guest@youpass.test',
  birthdate: '1998-06-15',
  gender: 'other' as const,
  preferredLanguage: 'en' as const,
};

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: '+56988777123' },
        { email: TEST_USER.email },
      ],
    },
  });

  if (existing) {
    console.log('Test user already exists — reusing account.');
    console.log('');
    console.log('Name:', existing.fullName);
    console.log('Phone (E.164):', existing.phone);
    console.log('Phone (app input, Chile):', '9 8877 7123');
    console.log('Country:', existing.countryCode);
    console.log('Email:', existing.email);
    printLoginHelp(existing.phone);
    return;
  }

  const sendCode = await api('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({
      phone: TEST_USER.phone,
      country_code: TEST_USER.countryCode,
      purpose: 'register',
    }),
  });

  if (sendCode.status !== 200 || !sendCode.body?.success) {
    throw new Error(`send-code failed: ${JSON.stringify(sendCode.body)}`);
  }

  const otp =
    sendCode.body.data?.dev_otp_code ??
    sendCode.body.data?.code ??
    process.env.DEV_OTP_CODE;

  if (!otp) {
    throw new Error(
      'No dev OTP returned. Check backend console for [DEV OTP] line after send-code.',
    );
  }

  const register = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone: TEST_USER.phone,
      country_code: TEST_USER.countryCode,
      code: String(otp),
      full_name: TEST_USER.fullName,
      rut_or_passport: TEST_USER.rutOrPassport,
      email: TEST_USER.email,
      birthdate: TEST_USER.birthdate,
      gender: TEST_USER.gender,
      preferred_language: TEST_USER.preferredLanguage,
      accept_terms: true,
    }),
  });

  if (register.status !== 201 || !register.body?.success) {
    throw new Error(`register failed: ${JSON.stringify(register.body)}`);
  }

  const user = register.body.data?.user;
  const phone = user?.phone ?? '+56988777123';

  console.log('Registered invite test user successfully.');
  console.log('');
  console.log('Name:', user?.full_name ?? TEST_USER.fullName);
  console.log('Phone (E.164):', phone);
  console.log('Phone (app input, Chile):', '9 8877 7123');
  console.log('Country:', TEST_USER.countryCode);
  console.log('Email:', TEST_USER.email);
  printLoginHelp(phone);
}

function printLoginHelp(phone: string) {
  console.log('');
  console.log('--- How to test invite flow ---');
  console.log('1. On your main account: assign a ticket to this phone number.');
  console.log('   Search guest by: 988777123 or Invite Test Guest');
  console.log('2. On a second device/simulator: log in with Chile +56 and phone 988777123');
  console.log('3. Request login OTP — in dev, code prints in backend terminal as [DEV OTP]');
  console.log('4. Open Invitations in the app — the invite should appear.');
  console.log('');
  console.log(`Stored phone for lookup: ${phone}`);
}

main()
  .catch((error) => {
    console.error('FAIL:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
