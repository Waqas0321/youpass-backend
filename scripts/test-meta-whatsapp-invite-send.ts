/**
 * Send a live Meta WhatsApp invitation template to a phone.
 *
 * Usage:
 *   npx tsx scripts/test-meta-whatsapp-invite-send.ts +923205905161
 *
 * Requires approved WHATSAPP_INVITATION_TEMPLATE_* + Meta credentials in .env
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { sendMetaWhatsAppTemplate } from '../src/modules/messaging/meta-whatsapp.service.js';
import { claimTokenFromUrl } from '../src/modules/messaging/invitation-delivery.service.js';

const to = (process.argv[2] ?? '+923205905161').trim();

async function main(): Promise<void> {
  const templateName = env.WHATSAPP_INVITATION_TEMPLATE_NAME.trim() || 'youpass_invite';
  const languageCode =
    env.WHATSAPP_INVITATION_TEMPLATE_LANGUAGE.trim() ||
    env.WHATSAPP_OTP_TEMPLATE_LANGUAGE.trim() ||
    'en_US';

  const claimUrl = `${env.APP_CLAIM_BASE_URL.replace(/\/$/, '')}/e2e-demo-token`;
  const claimToken = claimTokenFromUrl(claimUrl);

  console.log(`Sending invite template "${templateName}" (${languageCode}) → ${to}`);
  console.log(`Claim button suffix: ${claimToken}`);

  const result = await sendMetaWhatsAppTemplate({
    toE164: to,
    templateName,
    languageCode,
    bodyParameters: ['Osama', 'YouPass E2E', 'Meta Invite Test'],
    urlButtonParameter: claimToken,
  });

  console.log('Accepted by Meta:', result);
  console.log('Check WhatsApp on', to);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
