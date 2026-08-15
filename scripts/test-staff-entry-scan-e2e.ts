/**
 * Verify staff entry scan E2E: first scan validates, second returns already_used.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-entry-scan-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { findInvitationTicketByScanInput } from '../src/modules/invitations/invitation-ticket-scan.utils.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '912345678';
const STAFF_COUNTRY = 'CL';

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
  const ticket = await findPendingTicket();

  if (!ticket) {
    console.log('SKIP: No pending invitation ticket in database.');
    return;
  }

  if (ticket.invitation.status !== 'accepted' && ticket.invitation.status !== 'validated') {
    console.log(`SKIP: Ticket invitation status is ${ticket.invitation.status}`);
    return;
  }

  const manualCode = ticket.manualEntryId;
  console.log('Testing entry:', ticket.invitation.event.title);
  console.log('Guest:', ticket.invitation.recipient?.fullName);
  console.log('Manual code:', manualCode);

  const resolved = await findInvitationTicketByScanInput(manualCode);
  if (!resolved) {
    throw new Error('Manual entry code lookup failed');
  }
  console.log('Manual lookup OK');

  const token = await staffLogin();

  const firstScan = await api('/staff/scan/entry', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_payload: manualCode }),
  });
  console.log('First scan:', firstScan.status, firstScan.body?.data?.outcome);

  const secondScan = await api('/staff/scan/entry', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_payload: manualCode }),
  });
  console.log('Second scan:', secondScan.status, secondScan.body?.data?.outcome);

  const recent = await api('/staff/scan/recent?scan_type=entry&limit=5', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Recent entry scans:', recent.body?.data?.scans?.length ?? 0);

  const ok =
    firstScan.body?.data?.outcome === 'valid' &&
    secondScan.body?.data?.outcome === 'already_used' &&
    recent.status === 200 &&
    (recent.body?.data?.scans?.length ?? 0) >= 2;

  console.log(ok ? 'PASS: Entry scan E2E works.' : 'FAIL: Unexpected entry scan state.');
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
