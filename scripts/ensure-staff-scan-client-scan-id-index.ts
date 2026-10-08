/**
 * Ensure sparse unique index on staff_scan_logs.client_scan_id (M10).
 * Mongo unique indexes are not sparse by default, so online scans with null
 * collide — we create sparse uniqueness out-of-band.
 *
 * Run: npx tsx scripts/ensure-staff-scan-client-scan-id-index.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const COLLECTION = 'staff_scan_logs';
const INDEX_NAME = 'staff_scan_logs_client_scan_id_sparse_key';

async function main() {
  const listed = (await prisma.$runCommandRaw({
    listIndexes: COLLECTION,
  })) as { cursor?: { firstBatch?: Array<{ name: string }> } };

  const existing = listed.cursor?.firstBatch ?? [];
  const hasSparse = existing.some((idx) => idx.name === INDEX_NAME);
  const legacyUnique = existing.find(
    (idx) => idx.name === 'staff_scan_logs_client_scan_id_key',
  );

  if (legacyUnique) {
    console.log('Dropping non-sparse unique index', legacyUnique.name);
    await prisma.$runCommandRaw({
      dropIndexes: COLLECTION,
      index: legacyUnique.name,
    });
  }

  if (hasSparse) {
    console.log('Sparse unique index already present:', INDEX_NAME);
    return;
  }

  console.log('Creating sparse unique index:', INDEX_NAME);
  await prisma.$runCommandRaw({
    createIndexes: COLLECTION,
    indexes: [
      {
        key: { client_scan_id: 1 },
        name: INDEX_NAME,
        unique: true,
        sparse: true,
      },
    ],
  });

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
