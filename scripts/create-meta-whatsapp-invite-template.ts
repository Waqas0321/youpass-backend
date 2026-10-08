/**
 * Create Meta WhatsApp Utility invitation template for YouPass.
 *
 * Body: guest name, inviter, event title
 * Button: URL https://youpass.app/claim/{{1}}  (dynamic claim token suffix)
 *
 * Usage:
 *   npx tsx scripts/create-meta-whatsapp-invite-template.ts
 *
 * Requires: WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { metaGraphApiBaseUrl } from '../src/config/meta-whatsapp.config.js';

const templateName = (env.WHATSAPP_INVITATION_TEMPLATE_NAME || 'youpass_invite').trim();
const language = (
  env.WHATSAPP_INVITATION_TEMPLATE_LANGUAGE ||
  env.WHATSAPP_OTP_TEMPLATE_LANGUAGE ||
  'en_US'
).trim();

const CLAIM_URL_BASE = 'https://youpass.app/claim/';

async function main(): Promise<void> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID');
    process.exit(1);
  }

  const url = `${metaGraphApiBaseUrl()}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;
  const payload = {
    name: templateName,
    language,
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, {{2}} invited you to {{3}} on YouPass. Tap below to claim your pass.',
        example: {
          body_text: [['Alex', 'YouPass Events', 'Jazz Night']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Claim pass',
            url: `${CLAIM_URL_BASE}{{1}}`,
            example: ['demo-token'],
          },
        ],
      },
    ],
  };

  console.log(`Creating Utility template "${templateName}" (${language})...`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed: { id?: string; status?: string; error?: { message?: string } };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    console.error('Non-JSON:', response.status, raw);
    process.exit(1);
  }

  if (!response.ok || parsed.error) {
    const msg = parsed.error?.message ?? raw;
    if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
      console.log(`Template "${templateName}" already exists — OK.`);
      return;
    }
    console.error('Failed:', msg);
    process.exit(1);
  }

  console.log('Template submitted:', parsed);
  console.log(`Set WHATSAPP_INVITATION_TEMPLATE_NAME=${templateName}`);
  console.log(`Set WHATSAPP_INVITATION_TEMPLATE_LANGUAGE=${language}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
