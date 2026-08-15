/**
 * Send a Meta WhatsApp template message (connectivity / dev test).
 *
 * Usage:
 *   npx tsx scripts/test-meta-whatsapp-send.ts
 *   npx tsx scripts/test-meta-whatsapp-send.ts +923205906161 hello_world en_US
 *
 * Requires in .env:
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 * Recipient must be added as a test number in Meta API Setup (Development mode).
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { sendMetaWhatsAppTemplate } from '../src/modules/messaging/meta-whatsapp.service.js';

const toE164 = process.argv[2] ?? '+923205906161';
const templateName = process.argv[3] ?? 'hello_world';
const languageCode = process.argv[4] ?? 'en_US';
const bodyParam = process.argv[5];

async function main(): Promise<void> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env');
    process.exit(1);
  }

  console.log('Meta WhatsApp test send');
  console.log(`  phone_number_id: ${env.WHATSAPP_PHONE_NUMBER_ID}`);
  console.log(`  api_version:     ${env.WHATSAPP_API_VERSION}`);
  console.log(`  to:              ${toE164}`);
  console.log(`  template:        ${templateName} (${languageCode})`);

  const result = await sendMetaWhatsAppTemplate({
    toE164,
    templateName,
    languageCode,
    bodyParameters: bodyParam ? [bodyParam] : undefined,
  });

  console.log('Success:', result);
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
