/**
 * Send a real Meta WhatsApp Authentication OTP (copy-code template).
 *
 * Usage:
 *   npx tsx scripts/test-meta-whatsapp-otp-send.ts
 *   npx tsx scripts/test-meta-whatsapp-otp-send.ts +923205905161 482913
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { metaOtpTemplateLanguage } from '../src/config/meta-whatsapp.config.js';
import { sendMetaWhatsAppOtp } from '../src/modules/messaging/meta-whatsapp.service.js';

const toE164 = process.argv[2] ?? env.WHATSAPP_TEST_RECIPIENT ?? '+923205905161';
const code =
  process.argv[3] ??
  String(Math.floor(100000 + Math.random() * 900000));

async function main(): Promise<void> {
  const templateName = env.WHATSAPP_OTP_TEMPLATE_NAME.trim();
  if (!templateName || templateName === 'hello_world') {
    console.error('Set WHATSAPP_OTP_TEMPLATE_NAME to your approved Authentication template (e.g. youpass_otp).');
    process.exit(1);
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
    process.exit(1);
  }

  const languageCode = metaOtpTemplateLanguage('en');

  console.log('Meta WhatsApp OTP test');
  console.log(`  to:       ${toE164}`);
  console.log(`  template: ${templateName} (${languageCode})`);
  console.log(`  code:     ${code}`);

  const result = await sendMetaWhatsAppOtp({
    toE164,
    templateName,
    languageCode,
    code,
  });

  console.log('Success:', result);
  console.log('Check WhatsApp on your phone for the OTP message.');
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
