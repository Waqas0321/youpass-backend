/**
 * Verify supervisor resolve-duplicate E2E:
 * scan duplicate -> fetch alert -> resolve -> verify resolved state.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-resolve-duplicate-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { findInvitationTicketByScanInput } from '../src/modules/invitations/invitation-ticket-scan.utils.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import { SUPERVISOR_PIN_LENGTH } from '../src/modules/staff-supervisor/staff-supervisor.constants.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '912345678';
const STAFF_COUNTRY = 'CL';
const TEST_SUPERVISOR_PIN = process.env.SUPERVISOR_TEST_PIN ?? '1234';

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function staffLogin() {
  const sendCode = await api('/staff-auth/send-code', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
    }),
  });

  const otp = sendCode.body?.data?.dev_otp_code ?? process.env.DEV_OTP_CODE;
  if (!otp) {
    throw new Error(`No dev OTP: ${JSON.stringify(sendCode.body)}`);
  }

  const login = await api('/staff-auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
      code: String(otp),
    }),
  });

  if (login.status !== 200 || !login.body?.success) {
    throw new Error(`Staff login failed: ${JSON.stringify(login.body)}`);
  }

  return login.body.data.access_token as string;
}

async function ensureSupervisorPin(staffMemberId: string) {
  if (TEST_SUPERVISOR_PIN.length !== SUPERVISOR_PIN_LENGTH) {
    throw new Error(`SUPERVISOR_TEST_PIN must be ${SUPERVISOR_PIN_LENGTH} digits`);
  }

  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      supervisorPinHash: await hashOtp(TEST_SUPERVISOR_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(TEST_SUPERVISOR_PIN),
      permissionIds: {
        set: [
          'scan_tickets',
          'tickets_supervisor',
          'general_admin',
          'scan_products',
          'bar_supervisor',
        ],
      },
    },
  });
}

async function findPendingTicket() {
  const rows = await prisma.invitationTicket.findMany({
    select: {
      manualEntryId: true,
      validatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  for (const row of rows) {
    if (row.validatedAt) {
      continue;
    }

    const ticket = await findInvitationTicketByScanInput(row.manualEntryId);
    if (!ticket) {
      continue;
    }

    const status = ticket.invitation.status;
    if (status === 'accepted' || status === 'validated') {
      return ticket;
    }
  }

  return null;
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
  });

  if (!staffMember) {
    console.log('SKIP: Staff member +56912345678 not found.');
    return;
  }

  await ensureSupervisorPin(staffMember.id);

  const ticket = await findPendingTicket();
  if (!ticket) {
    console.log('SKIP: No pending invitation ticket in database.');
    return;
  }

  const manualCode = ticket.manualEntryId;
  console.log('Testing duplicate resolve for:', ticket.invitation.event.title);
  console.log('Guest:', ticket.invitation.recipient?.fullName);
  console.log('Manual code:', manualCode);

  const token = await staffLogin();

  const firstScan = await api('/staff/scan/entry', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_payload: manualCode }),
  });

  const secondScan = await api('/staff/scan/entry', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_payload: manualCode }),
  });

  console.log('First scan:', firstScan.status, firstScan.body?.data?.outcome);
  console.log('Second scan:', secondScan.status, secondScan.body?.data?.outcome);

  if (
    firstScan.body?.data?.outcome !== 'valid' ||
    secondScan.body?.data?.outcome !== 'already_used'
  ) {
    console.log('FAIL: Could not produce duplicate scan state.');
    process.exit(1);
  }

  const encodedEntry = encodeURIComponent(manualCode);
  const alert = await api(`/staff/supervisor/entries/by-entry/${encodedEntry}/duplicate`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('Duplicate alert:', alert.status, alert.body?.data?.status);

  if (alert.status !== 200 || alert.body?.data?.is_pending !== true) {
    console.log('FAIL: Duplicate alert was not pending.', JSON.stringify(alert.body));
    process.exit(1);
  }

  const resolve = await api(
    `/staff/supervisor/entries/by-entry/${encodedEntry}/resolve-duplicate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'escalate_alert',
        reason: 'validation_error',
        notes: 'E2E duplicate resolution test',
      }),
    },
  );

  console.log('Resolve duplicate:', resolve.status, resolve.body?.data?.action);

  if (resolve.status !== 200 || resolve.body?.data?.resolved !== true) {
    console.log('FAIL: Resolve duplicate failed.', JSON.stringify(resolve.body));
    process.exit(1);
  }

  const alertAfter = await api(`/staff/supervisor/entries/by-entry/${encodedEntry}/duplicate`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('Alert after resolve:', alertAfter.status, alertAfter.body?.data?.status);

  const duplicateResolveAgain = await api(
    `/staff/supervisor/entries/by-entry/${encodedEntry}/resolve-duplicate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'escalate_alert',
        reason: 'validation_error',
        notes: 'Should fail because already resolved',
      }),
    },
  );

  console.log('Second resolve attempt:', duplicateResolveAgain.status, duplicateResolveAgain.body?.error?.code);

  const ok =
    alertAfter.status === 200 &&
    alertAfter.body?.data?.is_pending === false &&
    alertAfter.body?.data?.status === 'resolved' &&
    duplicateResolveAgain.status === 409 &&
    duplicateResolveAgain.body?.error?.code === 'DUPLICATE_ALREADY_RESOLVED';

  console.log(ok ? 'PASS: Resolve duplicate E2E works.' : 'FAIL: Unexpected resolve duplicate state.');
  if (!ok) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
