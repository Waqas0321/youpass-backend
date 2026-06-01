import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

async function main() {
  const app = createApp();

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
