import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logTwilioWhatsAppStartupSummary } from './config/twilio-whatsapp.config.js';
import { prisma } from './config/database.js';
import { startInvitationExpiryScheduler } from './modules/invitations/invitation-expiry.scheduler.js';
import { startGuaranteedPassReminderScheduler } from './modules/invitations/guaranteed-pass-reminder.scheduler.js';
import { startGuaranteedPassEventCloseScheduler } from './modules/invitations/guaranteed-pass-event-close.scheduler.js';
import { startAccountDeletionScheduler } from './modules/users/account-deletion.scheduler.js';
import { startTableLockExpiryScheduler } from './modules/vip-venue/table-lock-expiry.scheduler.js';

async function main() {
  logTwilioWhatsAppStartupSummary();
  const app = createApp();
  startInvitationExpiryScheduler();
  startGuaranteedPassReminderScheduler();
  startGuaranteedPassEventCloseScheduler();
  startAccountDeletionScheduler();
  startTableLockExpiryScheduler();

  app.listen(env.PORT, () => {
    console.log(`YOUPASS API running on http://localhost:${env.PORT}${env.API_PREFIX}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`OTP delivery: ${env.TWILIO_MOCK ? 'MOCK (logged to console)' : 'LIVE'} via ${env.OTP_DELIVERY_CHANNEL.toUpperCase()}`);
  });
}

main().catch(async (err) => {
  console.error('Failed to start server:', err);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
