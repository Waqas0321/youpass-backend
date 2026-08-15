/**
 * Create (or verify) Meta WhatsApp Authentication OTP template for YouPass.
 *
 * Usage:
 *   npx tsx scripts/create-meta-whatsapp-otp-template.ts
 *   npx tsx scripts/create-meta-whatsapp-otp-template.ts es
 *
 * Requires .env:
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { metaGraphApiBaseUrl } from '../src/config/meta-whatsapp.config.js';

const templateName = (process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'youpass_otp').trim();
const language = (process.argv[2] ?? process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE ?? 'en_US').trim();

const FOOTER_EXPIRATION_MINUTES = 3;

async function main(): Promise<void> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID');
    process.exit(1);
  }

  const url = `${metaGraphApiBaseUrl()}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

  const payload = {
    name: templateName,
    language,
    category: 'AUTHENTICATION',
    components: [
      {
        type: 'BODY',
        add_security_recommendation: true,
      },
      {
        type: 'FOOTER',
        code_expiration_minutes: FOOTER_EXPIRATION_MINUTES,
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'OTP',
            otp_type: 'COPY_CODE',
          },
        ],
      },
    ],
  };

  console.log(`Creating Authentication template "${templateName}" (${language}) on WABA ${env.WHATSAPP_BUSINESS_ACCOUNT_ID}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed: { id?: string; status?: string; error?: { message?: string; code?: number } };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    console.error('Non-JSON response:', response.status, raw);
    process.exit(1);
  }

  if (!response.ok || parsed.error) {
    const msg = parsed.error?.message ?? raw;
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`Template "${templateName}" (${language}) already exists — OK.`);
      console.log(`Set in .env: WHATSAPP_OTP_TEMPLATE_NAME=${templateName}`);
      console.log(`Set in .env: WHATSAPP_OTP_TEMPLATE_LANGUAGE=${language}`);
      return;
    }
    console.error('Failed:', msg);
    process.exit(1);
  }

  console.log('Template submitted:', parsed);
  console.log('');
  console.log('Next steps:');
  console.log(`1. Wait for Meta approval (often minutes for Authentication templates).`);
  console.log(`2. Set WHATSAPP_OTP_TEMPLATE_NAME=${templateName}`);
  console.log(`3. Set WHATSAPP_OTP_TEMPLATE_LANGUAGE=${language}`);
  console.log(`4. Run: npx tsx scripts/test-meta-whatsapp-otp-send.ts +923205905161`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
