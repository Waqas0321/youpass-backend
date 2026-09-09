/**
 * Integration: entry scan → History → authorize_reentry → Upcoming + QR again.
 * Run: npx tsx scripts/test-reentry-restores-my-tickets.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { staffSupervisorEntryOverrideService } from '../src/modules/staff-supervisor/staff-supervisor-entry-override.service.js';
import { ticketsService } from '../src/modules/tickets/tickets.service.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';
import {
  hasPendingReentry,
  resolveQrStatus,
} from '../src/modules/invitations/invitations.utils.js';
import {
  isPastTicket,
  isUpcomingTicket,
  resolveTicketStatus,
  type InvitationTicketRow,
} from '../src/modules/tickets/tickets.utils.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import { STAFF_PERMISSIONS } from '../src/modules/admin/admin-staff.constants.js';

const SUPERVISOR_PIN = '1234';
const STAFF_E164 = '+56990000222';

async function loadTicketRow(invitationId: string): Promise<InvitationTicketRow> {
  const row = await prisma.invitation.findUniqueOrThrow({
    where: { id: invitationId },
    include: {
      event: { include: { eventType: true } },
      producer: true,
      ticket: true,
    },
  });
  if (!row.ticket) {
    throw new Error('Ticket missing');
  }
  return row as InvitationTicketRow;
}

async function main() {
  const staff =
    (await prisma.staffMember.findFirst({ where: { phone: STAFF_E164 } })) ??
    (await prisma.staffMember.findFirst({ where: { phone: '+56912345678' } }));
  if (!staff) {
    throw new Error('No staff member found for supervisor override');
  }

  await prisma.staffMember.update({
    where: { id: staff.id },
    data: {
      permissionIds: { set: STAFF_PERMISSIONS.map((p) => p.id) },
      supervisorPinHash: await hashOtp(SUPERVISOR_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(SUPERVISOR_PIN),
    },
  });

  const candidate = await prisma.invitation.findFirst({
    where: {
      recipientUserId: { not: null },
      ticket: { isNot: null },
      event: {
        status: 'published',
        startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      status: { in: ['accepted', 'validated'] },
    },
    include: {
      ticket: true,
      event: true,
      recipient: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!candidate?.ticket || !candidate.recipientUserId) {
    throw new Error('No suitable invitation ticket found to test re-entry');
  }

  const invitationId = candidate.id;
  const ticketId = candidate.ticket.id;
  const userId = candidate.recipientUserId;
  const userPhone = candidate.recipientPhone;

  console.log(
    JSON.stringify(
      {
        invitationId,
        ticketId,
        userId,
        phone: userPhone,
        event: candidate.event.title,
        before: {
          status: candidate.status,
          validatedAt: candidate.ticket.validatedAt,
          unlockAt: candidate.ticket.unlockAt,
        },
      },
      null,
      2,
    ),
  );

  // 1) Ensure ticket is scanned / validated (History state)
  const validatedAt = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.invitationTicket.update({
    where: { id: ticketId },
    data: {
      validatedAt,
      unlockAt: validatedAt,
      consumptionCount: 1,
    },
  });
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'validated' },
  });

  let row = await loadTicketRow(invitationId);
  assert.equal(resolveTicketStatus(row, row.event, row.ticket), 'validated');
  assert.equal(isPastTicket(row), true);
  assert.equal(isUpcomingTicket(row), false);
  assert.equal(
    resolveQrStatus(row.ticket.unlockAt, row.ticket.validatedAt, row.event.startsAt),
    'redeemed',
  );
  console.log('PASS  after scan → History / QR redeemed');

  const upcomingBefore = await ticketsService.listUpcoming(userId, {
    page: 1,
    limit: 50,
  });
  const inUpcomingBefore = (upcomingBefore.tickets as Array<{ id: string }>).some(
    (t) => t.id === invitationId,
  );
  assert.equal(inUpcomingBefore, false);
  console.log('PASS  listUpcoming does not include scanned ticket');

  // 2) Supervisor authorize re-entry
  await staffSupervisorEntryOverrideService.applyOverride(ticketId, staff.id, {
    pin: SUPERVISOR_PIN,
    action: 'authorize_reentry',
    notes: 'QA re-entry restore My Tickets',
  });

  row = await loadTicketRow(invitationId);
  assert.ok(row.ticket.validatedAt, 'validatedAt should be preserved');
  assert.equal(
    hasPendingReentry(row.ticket.unlockAt, row.ticket.validatedAt),
    true,
  );
  assert.equal(resolveTicketStatus(row, row.event, row.ticket), 'active');
  assert.equal(isUpcomingTicket(row), true);
  assert.equal(isPastTicket(row), false);
  assert.equal(
    resolveQrStatus(row.ticket.unlockAt, row.ticket.validatedAt, row.event.startsAt),
    'available',
  );
  console.log('PASS  after authorize_reentry → active / QR available');

  const upcomingAfter = await ticketsService.listUpcoming(userId, {
    page: 1,
    limit: 50,
  });
  const inUpcomingAfter = (upcomingAfter.tickets as Array<{ id: string }>).some(
    (t) => t.id === invitationId,
  );
  assert.equal(inUpcomingAfter, true);
  console.log('PASS  listUpcoming includes restored ticket');

  const qr = await invitationsService.getTicket(userId, userPhone, invitationId);
  assert.equal(qr.qr_status, 'available');
  assert.ok(qr.qr_payload);
  console.log('PASS  getTicket QR available again');

  console.log(
    JSON.stringify(
      {
        result: 'ok',
        after: {
          status: row.status,
          validatedAt: row.ticket.validatedAt,
          unlockAt: row.ticket.unlockAt,
          ticketStatus: resolveTicketStatus(row, row.event, row.ticket),
          qr_status: qr.qr_status,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
