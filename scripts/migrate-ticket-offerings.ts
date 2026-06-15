/**
 * Migrates legacy event_ticket_offerings (slug/label/stockQuantity) to the new schema.
 * Run: npx tsx scripts/migrate-ticket-offerings.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG_TO_TYPE: Record<string, string> = {
  'preventa-1': 'early_bird',
  'preventa-2': 'preventa_2',
  'preventa-3': 'preventa_3',
  'general-cover': 'general',
  'vip-general': 'vip_general',
};

const TYPE_LABELS: Record<string, string> = {
  early_bird: 'Early Bird',
  preventa_2: 'Pre-sale 2nd wave',
  preventa_3: 'Pre-sale 3rd wave',
  general: 'General',
  vip_general: 'VIP General',
};

type LegacyOffering = {
  _id: { $oid: string };
  eventId?: string;
  event_id?: { $oid: string };
  slug?: string;
  label?: string;
  type?: string;
  name?: string;
  stockQuantity?: number | null;
  stock_quantity?: number | null;
  soldQuantity?: number;
  sold_quantity?: number;
  stockTotal?: number | null;
  stock_total?: number | null;
  stockRemaining?: number | null;
  stock_remaining?: number | null;
  isActive?: boolean;
  is_active?: boolean;
  status?: string;
};

async function main() {
  const raw = await prisma.$runCommandRaw({
    find: 'event_ticket_offerings',
    filter: {},
  });

  const docs = (raw as { cursor?: { firstBatch?: LegacyOffering[] } }).cursor?.firstBatch ?? [];
  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const docId = doc._id.$oid;
    const legacySlug = doc.slug;
    const resolvedType = doc.type ?? (legacySlug ? SLUG_TO_TYPE[legacySlug] : null);

    if (!resolvedType) {
      console.warn(`Skip ${docId}: no type or known slug`);
      skipped += 1;
      continue;
    }

    const stockTotal =
      doc.stockTotal ?? doc.stock_total ?? doc.stockQuantity ?? doc.stock_quantity ?? null;
    const sold =
      doc.soldQuantity ??
      doc.sold_quantity ??
      (stockTotal != null && (doc.stockRemaining ?? doc.stock_remaining) != null
        ? Math.max(0, stockTotal - (doc.stockRemaining ?? doc.stock_remaining)!)
        : 0);
    const stockRemaining =
      doc.stockRemaining ??
      doc.stock_remaining ??
      (stockTotal != null ? Math.max(0, stockTotal - sold) : null);

    let status = doc.status;
    if (!status) {
      const inactive = doc.isActive === false || doc.is_active === false;
      if (inactive || (stockRemaining != null && stockRemaining <= 0)) {
        status = 'sold_out';
      } else {
        status = 'active';
      }
    }

    const name = doc.name ?? doc.label ?? TYPE_LABELS[resolvedType] ?? resolvedType;

    await prisma.$runCommandRaw({
      update: 'event_ticket_offerings',
      updates: [
        {
          q: { _id: { $oid: docId } },
          u: {
            $set: {
              type: resolvedType,
              name,
              stock_total: stockTotal,
              stock_remaining: stockRemaining,
              status,
            },
            $unset: {
              slug: '',
              label: '',
              section: '',
              description: '',
              badge_label: '',
              stock_quantity: '',
              sold_quantity: '',
              is_active: '',
              maps_to_tier: '',
              maps_to_type: '',
              sale_starts_at: '',
              sale_ends_at: '',
            },
          },
        },
      ],
    });

    migrated += 1;
    console.log(`✓ ${docId} → ${resolvedType} (${name})`);
  }

  console.log(`Done — migrated ${migrated}, skipped ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
