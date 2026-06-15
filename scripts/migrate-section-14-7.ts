/**
 * Section 14.7 — migrate legacy invitation documents to the new data model.
 *
 * Run: npx tsx scripts/migrate-section-14-7.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LegacyInvitation = {
  _id: { $oid: string };
  type?: string;
  status?: string;
  charge_amount?: number;
  discount_percent?: number;
  preauth_reference?: string;
  preauth_released_at?: { $date: string };
  capture_reference?: string;
  payment_reference?: string;
  capture_attempt_count?: number;
  charge_failed_at?: { $date: string };
  requires_payment_method?: boolean;
  assigned_slot?: string;
  recipient_phone?: string;
  cancellation_deadline?: { $date: string };
  sent_at?: { $date: string };
  event_id?: { $oid: string };
};

function mapLegacyType(type?: string): 'free' | 'guaranteed' | 'discount' {
  if (type === 'courtesy' || type === 'guaranteed') return 'guaranteed';
  if (type === 'discounted' || type === 'discount') return 'discount';
  return 'free';
}

function mapLegacyStatus(
  status?: string,
  captureReference?: string,
  chargeFailedAt?: string,
  captureAttempts?: number,
  viewedAt?: string,
): string {
  if (chargeFailedAt && (captureAttempts ?? 0) >= 3) return 'failed';
  if (captureReference) return 'charged';
  if (status === 'pending') return viewedAt ? 'viewed' : 'sent';
  if (status === 'confirmed') return 'accepted';
  if (status === 'cancelled') return 'canceled';
  return status ?? 'sent';
}

async function migrateInvitations() {
  const raw = await prisma.$runCommandRaw({
    find: 'invitations',
    filter: {},
  }) as { cursor?: { firstBatch?: LegacyInvitation[] } };

  const docs = raw.cursor?.firstBatch ?? [];
  let updated = 0;

  for (const doc of docs) {
    const id = doc._id.$oid;
    const legacyType = doc.type;
    const entryValue = doc.charge_amount ?? 0;
    const discountPercentage = doc.discount_percent ?? null;
    const productType = mapLegacyType(legacyType);
    let amountToPay = 0;
    if (productType === 'discount' && discountPercentage) {
      amountToPay = Math.round(entryValue * (1 - discountPercentage / 100));
    }

    const newStatus = mapLegacyStatus(
      doc.status,
      doc.capture_reference,
      doc.charge_failed_at?.$date,
      doc.capture_attempt_count,
    );

    await prisma.$runCommandRaw({
      update: 'invitations',
      updates: [
        {
          q: { _id: { $oid: id } },
          u: {
            $set: {
              type: productType,
              status: newStatus,
              entry_value: entryValue,
              amount_to_pay: amountToPay,
              discount_percentage: discountPercentage,
              assigned_slot: doc.assigned_slot ?? 'General Access',
              recipient_phone: doc.recipient_phone ?? '+00000000000',
              cancellation_deadline: doc.cancellation_deadline ?? doc.sent_at,
            },
            $unset: {
              charge_amount: '',
              discount_percent: '',
              preauth_reference: '',
              preauth_released_at: '',
              capture_reference: '',
              payment_reference: '',
              capture_attempt_count: '',
              charge_failed_at: '',
              requires_payment_method: '',
              terms_accepted_required: '',
              gp_reminders_sent: '',
            },
          },
        },
      ],
    });

    if (doc.preauth_reference && productType === 'guaranteed') {
      const existing = await prisma.invitationPreAuth.findUnique({
        where: { invitationId: id },
      });
      if (!existing) {
        const invitation = await prisma.invitation.findUnique({
          where: { id },
          select: { recipientUserId: true },
        });
        const card = invitation?.recipientUserId
          ? await prisma.userPaymentMethod.findFirst({
              where: { userId: invitation.recipientUserId, isDefault: true },
            })
          : null;

        if (invitation?.recipientUserId && card) {
          await prisma.invitationPreAuth.create({
            data: {
              invitationId: id,
              userId: invitation.recipientUserId,
              cardId: card.id,
              amount: entryValue,
              gateway: card.gateway ?? 'klap',
              gatewayTransactionId: doc.preauth_reference,
              status: doc.capture_reference
                ? 'captured'
                : doc.preauth_released_at
                  ? 'released'
                  : 'pre_authorized',
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              releasedAt: doc.preauth_released_at
                ? new Date(doc.preauth_released_at.$date)
                : null,
              capturedAt: doc.capture_reference ? new Date() : null,
            },
          });
        }
      }
    }

    updated += 1;
  }

  return updated;
}

async function migrateEventInvitationSettings() {
  const legacy = await prisma.$runCommandRaw({
    find: 'event_invitation_settings',
    filter: {},
  }) as { cursor?: { firstBatch?: Array<Record<string, unknown>> } };

  const docs = legacy.cursor?.firstBatch ?? [];
  let migrated = 0;

  for (const doc of docs) {
    const eventId = (doc.event_id as { $oid: string })?.$oid;
    if (!eventId) continue;

    await prisma.invitationSettings.upsert({
      where: { eventId },
      create: {
        eventId,
        allowFree: (doc.enable_free as boolean) ?? true,
        allowGuaranteed: (doc.enable_guaranteed as boolean) ?? true,
        allowDiscount: (doc.enable_discounted as boolean) ?? true,
        freeCancellationDays: (doc.free_cancellation_deadline_days as number) ?? 7,
        guaranteedCancellationDays: (doc.guaranteed_cancellation_deadline_days as number) ?? 3,
        discountCancellationDays: (doc.discounted_cancellation_deadline_days as number) ?? 2,
        discountPercentage: Array.isArray(doc.discount_percentages)
          ? (doc.discount_percentages[0] as number)
          : null,
      },
      update: {},
    });
    migrated += 1;
  }

  return migrated;
}

async function ensureSettingsForAllEvents() {
  const events = await prisma.event.findMany({ select: { id: true } });
  let created = 0;
  for (const event of events) {
    const existing = await prisma.invitationSettings.findUnique({
      where: { eventId: event.id },
    });
    if (!existing) {
      await prisma.invitationSettings.create({
        data: {
          eventId: event.id,
          allowFree: true,
          allowGuaranteed: true,
          allowDiscount: true,
          freeCancellationDays: 7,
          guaranteedCancellationDays: 3,
          discountCancellationDays: 2,
        },
      });
      created += 1;
    }
  }
  return created;
}

async function main() {
  console.log('[14.7] Pushing schema — run npm run db:push first if not done.');
  const invitations = await migrateInvitations();
  const settings = await migrateEventInvitationSettings();
  const created = await ensureSettingsForAllEvents();
  console.log(`[14.7] Migrated ${invitations} invitations`);
  console.log(`[14.7] Migrated ${settings} event_invitation_settings → invitation_settings`);
  console.log(`[14.7] Created ${created} missing invitation_settings rows`);
}

main()
  .catch((error) => {
    console.error('[14.7] Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
