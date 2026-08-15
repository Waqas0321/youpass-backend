/**
 * Verify supervisor entry manual validation E2E:
 * reset entry to pending -> fetch context -> authorize_entry -> verify authorized.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-entry-manual-validation-e2e.ts
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
const ENTRY_CODE = process.env.MANUAL_VALIDATION_ENTRY_CODE ?? 'QN3FJC';

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

async function resetEntryToPending(ticketId: string, invitationId: string) {
  await prisma.$transaction([
    prisma.invitationTicket.update({
      where: { id: ticketId },
      data: { validatedAt: null },
    }),
    prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'accepted', respondedAt: null },
    }),
  ]);
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
  });

  if (!staffMember) {
    console.log('SKIP: Staff member +56912345678 not found.');
    process.exit(0);
  }

  await ensureSupervisorPin(staffMember.id);

  const ticket = await findInvitationTicketByScanInput(ENTRY_CODE);
  if (!ticket) {
    throw new Error(`Entry code not found: ${ENTRY_CODE}`);
  }

  await resetEntryToPending(ticket.id, ticket.invitationId);

  const token = await staffLogin();
  const auth = { Authorization: `Bearer ${token}` };

  const contextRes = await api(
    `/staff/supervisor/entries/by-entry/${encodeURIComponent(ENTRY_CODE)}/manual-validation`,
    { headers: auth },
  );

  if (contextRes.status !== 200 || !contextRes.body?.success) {
    throw new Error(`GET manual validation context failed: ${JSON.stringify(contextRes.body)}`);
  }

  const before = contextRes.body.data;
  console.log('Context loaded:', {
    guest: before.guest_name,
    qr_id: before.qr_id,
    system_status: before.system_status,
    can_authorize: before.can_authorize,
  });

  if (before.system_status !== 'pending') {
    throw new Error(`Expected pending system_status, got ${before.system_status}`);
  }

  const applyRes = await api(
    `/staff/supervisor/entries/by-entry/${encodeURIComponent(ENTRY_CODE)}/manual-validation`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'authorize_entry',
        reason: 'phone_battery',
        notes: 'E2E manual validation test',
      }),
    },
  );

  if (applyRes.status !== 200 || !applyRes.body?.success) {
    throw new Error(`POST manual validation failed: ${JSON.stringify(applyRes.body)}`);
  }

  const after = applyRes.body.data.context;
  console.log('Manual validation applied:', {
    action: applyRes.body.data.action,
    system_status: after.system_status,
    entry_status: after.entry_status,
  });

  if (after.system_status !== 'authorized') {
    throw new Error(`Expected authorized system_status, got ${after.system_status}`);
  }

  await resetEntryToPending(ticket.id, ticket.invitationId);

  const tempQrRes = await api(
    `/staff/supervisor/entries/by-entry/${encodeURIComponent(ENTRY_CODE)}/manual-validation`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'generate_temporary_qr',
        reason: 'damaged_qr',
        notes: 'E2E temporary QR test',
      }),
    },
  );

  if (tempQrRes.status !== 200 || !tempQrRes.body?.success) {
    throw new Error(`POST generate_temporary_qr failed: ${JSON.stringify(tempQrRes.body)}`);
  }

  const tempQr = tempQrRes.body.data.temporary_qr;
  if (!tempQr?.qr_payload || !tempQr?.entry_code) {
    throw new Error(`Missing temporary_qr payload: ${JSON.stringify(tempQrRes.body.data)}`);
  }

  const tempContext = tempQrRes.body.data.context;
  if (tempContext.is_qr_unavailable) {
    throw new Error('Expected QR to be available after generate_temporary_qr');
  }

  console.log('Temporary QR generated:', {
    entry_code: tempQr.entry_code,
    validity_minutes: tempQr.validity_minutes,
    expires_at: tempQr.expires_at,
  });

  console.log('PASS: entry manual validation E2E');
}

main()
  .catch((error) => {
    console.error('FAIL:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
