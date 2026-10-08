/**
 * E2E against production (or local) API: send WhatsApp OTP — no autofill / no dev_otp.
 *
 * Usage:
 *   npx tsx scripts/test-auth-e2e-whatsapp-otp.ts
 *   API_BASE=https://youpass-backend-two.vercel.app/api/v1 npx tsx scripts/test-auth-e2e-whatsapp-otp.ts
 *
 * After the OTP arrives on WhatsApp, verify with:
 *   OTP=123456 npx tsx scripts/test-auth-e2e-whatsapp-otp.ts --verify
 */
import 'dotenv/config';

const API =
  process.env.API_BASE?.replace(/\/$/, '') ??
  'https://youpass-backend-two.vercel.app/api/v1';

const TEST = {
  phone: process.env.E2E_PHONE ?? '3205905161',
  country_code: process.env.E2E_COUNTRY ?? 'PK',
  purpose: (process.env.E2E_PURPOSE as 'login' | 'register') ?? 'login',
};

async function sendCode(): Promise<void> {
  console.log(`POST ${API}/auth/send-code`, TEST);
  const response = await fetch(`${API}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST),
  });
  const body = (await response.json()) as {
    success?: boolean;
    message?: string;
    error?: { code?: string; message?: string };
    data?: Record<string, unknown>;
  };

  console.log('Status:', response.status);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || !body.success) {
    process.exit(1);
  }

  if (body.data && 'dev_otp_code' in body.data && body.data.dev_otp_code) {
    console.error('FAIL: API returned dev_otp_code — mock mode is still on.');
    process.exit(1);
  }

  console.log('');
  console.log('OTP sent via WhatsApp. Enter the code from your phone (no autofill).');
  console.log(`Then: OTP=<code> npx tsx scripts/test-auth-e2e-whatsapp-otp.ts --verify`);
}

async function verifyCode(): Promise<void> {
  const code = (process.env.OTP ?? '').trim();
  if (!/^\d{4,8}$/.test(code)) {
    console.error('Set OTP=###### (digits from WhatsApp)');
    process.exit(1);
  }

  const path =
    TEST.purpose === 'register' ? `${API}/auth/register` : `${API}/auth/login`;
  const payload =
    TEST.purpose === 'register'
      ? {
          phone: TEST.phone,
          country_code: TEST.country_code,
          code,
          name: process.env.E2E_NAME ?? 'E2E WhatsApp User',
          accept_terms: true,
        }
      : {
          phone: TEST.phone,
          country_code: TEST.country_code,
          code,
        };

  console.log(`POST ${path}`);
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  console.log('Status:', response.status);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || !body.success) {
    process.exit(1);
  }
  console.log('Verify OK — session established.');
}

async function main(): Promise<void> {
  if (process.argv.includes('--verify')) {
    await verifyCode();
  } else {
    await sendCode();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
