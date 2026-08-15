/**
 * E2E: POST /auth/send-code via Meta WhatsApp OTP (requires running API).
 *
 * Usage:
 *   PORT=3002 npx tsx scripts/test-auth-send-code-meta.ts
 */
import 'dotenv/config';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;

const TEST = {
  phone: '3205905161',
  country_code: 'PK',
  purpose: 'register' as const,
};

async function main(): Promise<void> {
  const response = await fetch(`${API}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST),
  });
  const body = await response.json();
  console.log('Status:', response.status);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || !body.success) {
    process.exit(1);
  }

  console.log('');
  console.log('OTP sent via Meta WhatsApp. Check your phone (+923205905161).');
  if (body.data?.dev_otp_code) {
    console.log('dev_otp_code (mock mode only):', body.data.dev_otp_code);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
