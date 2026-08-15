/**
 * Reset a resolved duplicate alert back to pending for supervisor testing.
 *
 * Run: npx tsx scripts/reset-duplicate-alert-pending.ts [entryCode]
 * Example: npx tsx scripts/reset-duplicate-alert-pending.ts QN3FJC
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { findInvitationTicketByScanInput } from '../src/modules/invitations/invitation-ticket-scan.utils.js';

const entryCode = process.argv[2]?.trim() || 'QN3FJC';

async function main() {
  const ticket = await findInvitationTicketByScanInput(entryCode);

  if (!ticket) {
    console.error(`Entry not found for code: ${entryCode}`);
    process.exit(1);
  }

  if (!ticket.validatedAt) {
    console.error(
      `Entry ${entryCode} is not validated yet. Scan it once first, then scan again for duplicate.`,
    );
    process.exit(1);
  }

  const duplicateScans = await prisma.staffScanLog.count({
    where: {
      entryId: ticket.manualEntryId,
      scanType: 'entry',
      outcome: 'already_used',
    },
  });

  if (duplicateScans === 0) {
    console.error(
      `Entry ${entryCode} has no duplicate scan logs. Scan the same QR a second time first.`,
    );
    process.exit(1);
  }

  const deleted = await prisma.invitationAuditLog.deleteMany({
    where: {
      invitationId: ticket.invitation.id,
      action: { startsWith: 'supervisor_duplicate_' },
    },
  });

  const deletedSupervisorScans = await prisma.staffScanLog.deleteMany({
    where: {
      entryId: ticket.manualEntryId,
      scanType: 'entry',
      outcome: 'supervisor_resolved',
    },
  });

  console.log('Reset duplicate alert to pending');
  console.log('Entry code:', ticket.manualEntryId);
  console.log('Guest:', ticket.invitation.recipient?.fullName ?? ticket.invitation.recipientName);
  console.log('Event:', ticket.invitation.event.title);
  console.log('Removed resolution audit logs:', deleted.count);
  console.log('Removed supervisor_resolved scan logs:', deletedSupervisorScans.count);
  console.log('Duplicate scan attempts still on file:', duplicateScans);
  console.log('Reload the resolve duplicate screen — it should show pending actions again.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
