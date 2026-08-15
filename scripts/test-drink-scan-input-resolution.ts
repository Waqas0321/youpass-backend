/**
 * Verify drink scan resolves manual entry codes (6 chars) and full qr payloads.
 * Run: npx tsx scripts/test-drink-scan-input-resolution.ts HK5SMS
 */
import 'dotenv/config';
import { findDrinkRedemptionByScanInput } from '../src/modules/event-drinks/event-drink-redemption.service.js';
import { prisma } from '../src/config/database.js';

const scanInput = process.argv[2]?.trim() || 'HK5SMS';

async function main() {
  const redemption = await findDrinkRedemptionByScanInput(scanInput);

  if (!redemption) {
    console.error(`No redemption found for scan input: ${scanInput}`);
    process.exit(1);
  }

  console.log('Found redemption:');
  console.log('  manualEntryId:', redemption.manualEntryId);
  console.log('  qrPayload:', redemption.qrPayload.slice(0, 48) + '...');
  console.log('  product:', redemption.line?.productName ?? 'unknown');
  console.log('  validatedAt:', redemption.validatedAt?.toISOString() ?? null);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
