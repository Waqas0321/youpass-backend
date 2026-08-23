/**
 * One-off: set Chile payment gateway to Kushki.
 * Run: npx tsx scripts/set-chile-kushki-gateway.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.country.updateMany({
    where: { code: 'CL' },
    data: { paymentGateway: 'kushki' },
  });
  console.log(`Updated ${result.count} country row(s) to paymentGateway=kushki`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
