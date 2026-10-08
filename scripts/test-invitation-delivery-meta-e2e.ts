/**
 * E2E: invitationDeliveryService → Meta Cloud WhatsApp (approved youpass_invite).
 *
 * Usage:
 *   npx tsx scripts/test-invitation-delivery-meta-e2e.ts +923205905161
 */
import 'dotenv/config';
import {
  buildClaimUrl,
  invitationDeliveryService,
} from '../src/modules/messaging/invitation-delivery.service.js';

const to = (process.argv[2] ?? '+923205905161').trim();

async function main(): Promise<void> {
  console.log('delivery service:', invitationDeliveryService.constructor.name);
  const claimUrl = buildClaimUrl(`e2e-svc-${Date.now()}`);
  const result = await invitationDeliveryService.sendGuestInvitation({
    guestPhone: to,
    guestName: 'Osama',
    inviterName: 'YouPass E2E',
    eventTitle: 'Invite Service Test',
    claimUrl,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.delivery_mode !== 'live' || !result.whatsapp_sent) {
    process.exit(1);
  }
  console.log('PASS: invitation WhatsApp delivered via Meta');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
