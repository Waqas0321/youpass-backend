/**
 * Section 14.7 — verify invitation data model tables and core flows.
 *
 * Run: npx tsx scripts/test-section-14-7.ts
 * Requires API running on :3000 and seeded data.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type Check = { name: string; pass: boolean; detail?: string };

const checks: Check[] = [];

function record(name: string, pass: boolean, detail?: string) {
  checks.push({ name, pass, detail });
  console.log(pass ? `✓ ${name}` : `✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function verifySchemaCollections() {
  const invitation = await prisma.invitation.findFirst({
    include: { preAuth: true, reminders: true },
  });

  record('invitations collection readable', invitation != null);
  if (invitation) {
    record('invitation has entry_value', typeof invitation.entryValue === 'number');
    record('invitation has amount_to_pay', typeof invitation.amountToPay === 'number');
    record(
      'invitation status is Section 14.7 enum',
      ['sent', 'viewed', 'accepted', 'rejected', 'expired', 'canceled', 'validated', 'charged', 'failed'].includes(
        invitation.status,
      ),
      invitation.status,
    );
    record(
      'invitation type is Section 14.7 enum',
      ['free', 'guaranteed', 'discount'].includes(invitation.type),
      invitation.type,
    );
  }

  const settings = await prisma.invitationSettings.findFirst();
  record('invitation_settings collection exists', settings != null);
  if (settings) {
    record('settings has allow_free', typeof settings.allowFree === 'boolean');
    record('settings has guaranteed_cancellation_days', settings.guaranteedCancellationDays === 3 || settings.guaranteedCancellationDays > 0);
  }

  const preAuthCount = await prisma.invitationPreAuth.count();
  record('invitation_pre_auths table accessible', true, `${preAuthCount} rows`);

  const reminderCount = await prisma.invitationReminder.count();
  record('invitation_reminders table accessible', true, `${reminderCount} rows`);
}

async function verifyEventDefaults() {
  const eventWithoutSettings = await prisma.event.findFirst({
    where: { invitationSettings: null },
  });
  record('all events have invitation_settings', eventWithoutSettings == null);
}

async function verifyAdminOverview() {
  const res = await fetch(`${API}/admin/overview`, {
    headers: { 'x-admin-key': ADMIN_KEY },
  });
  record('GET /admin/overview', res.ok, String(res.status));
}

async function main() {
  console.log('Section 14.7 — Data Model Verification\n');
  await verifySchemaCollections();
  await verifyEventDefaults();
  try {
    await verifyAdminOverview();
  } catch {
    record('GET /admin/overview (API reachable)', false, 'Is the API running?');
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main()
  .finally(() => prisma.$disconnect());
