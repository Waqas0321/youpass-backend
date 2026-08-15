/**
 * Verify supervisor entry override E2E:
 * fetch context -> apply release_qr -> verify context updated.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-entry-override-e2e.ts
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
const ENTRY_CODE = process.env.OVERRIDE_ENTRY_CODE ?? 'QN3FJC';

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

  const token = await staffLogin();
  const auth = { Authorization: `Bearer ${token}` };

  const contextRes = await api(
    `/staff/supervisor/entries/by-entry/${encodeURIComponent(ENTRY_CODE)}/override`,
    { headers: auth },
  );

  if (contextRes.status !== 200 || !contextRes.body?.success) {
    throw new Error(`GET override context failed: ${JSON.stringify(contextRes.body)}`);
  }

  const before = contextRes.body.data;
  console.log('Context loaded:', {
    guest: before.guest_name,
    qr_id: before.qr_id,
    is_validated: before.is_validated,
    is_blocked: before.is_blocked,
    logs: before.logs?.length ?? 0,
  });

  const action = before.is_validated ? 'release_qr' : 'revalidate_qr';

  const applyRes = await api(
    `/staff/supervisor/entries/by-entry/${encodeURIComponent(ENTRY_CODE)}/override`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action,
        notes: 'E2E override test',
      }),
    },
  );

  if (applyRes.status !== 200 || !applyRes.body?.success) {
    throw new Error(`POST override failed: ${JSON.stringify(applyRes.body)}`);
  }

  const after = applyRes.body.data.context;
  console.log('Override applied:', {
    action: applyRes.body.data.action,
    is_validated: after.is_validated,
    entry_status: after.entry_status,
  });

  if (action === 'release_qr' && after.is_validated) {
    throw new Error('Expected entry to be released (not validated)');
  }

  if (action === 'revalidate_qr' && !after.is_validated) {
    throw new Error('Expected entry to be validated');
  }

  console.log('PASS: entry override E2E');
}

main()
  .catch((error) => {
    console.error('FAIL:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
