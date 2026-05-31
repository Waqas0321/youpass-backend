import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

async function main() {
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`YOUPASS API running on http://localhost:${env.PORT}${env.API_PREFIX}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`WhatsApp mode: ${env.WHATSAPP_MOCK ? 'MOCK (OTP logged to console)' : 'LIVE'}`);
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
