/**
 * Verify supervisor system status E2E:
 * GET status, toggle offline mode, pause validations, staff alert
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-system-status-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import { SUPERVISOR_PIN_LENGTH } from '../src/modules/staff-supervisor/staff-supervisor.constants.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '912345678';
const STAFF_COUNTRY = 'CL';
const TEST_SUPERVISOR_PIN = process.env.SUPERVISOR_TEST_PIN ?? '1234';

async function api(path: string, init: RequestInit = {}, token?: string) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        set: ['scan_tickets', 'tickets_supervisor', 'general_admin'],
      },
    },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
    select: { id: true },
  });

  if (!staffMember) {
    console.log('SKIP: Staff member +56912345678 not found.');
    process.exit(0);
  }
  await ensureSupervisorPin(staffMember.id);

  const token = await staffLogin();

  const statusResponse = await api('/staff/supervisor/system-status', {}, token);
  assert(statusResponse.status === 200, `GET status failed: ${JSON.stringify(statusResponse.body)}`);
  assert(statusResponse.body?.success, 'GET status success flag missing');

  const status = statusResponse.body.data;
  assert(status.event_id, 'event_id missing');
  assert(Array.isArray(status.general_health), 'general_health missing');
  assert(Array.isArray(status.scanners), 'scanners missing');
  assert(Array.isArray(status.event_flow), 'event_flow missing');
  assert(Array.isArray(status.logs), 'logs missing');

  const offlineResponse = await api(
    '/staff/supervisor/system-status/actions',
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'offline_mode',
        event_id: status.event_id,
      }),
    },
    token,
  );

  assert(
    offlineResponse.status === 200,
    `offline_mode action failed: ${JSON.stringify(offlineResponse.body)}`,
  );
  assert(
    offlineResponse.body.data.operational_flags.offline_mode_enabled === true,
    'offline mode should be enabled after toggle',
  );

  const pauseResponse = await api(
    '/staff/supervisor/system-status/actions',
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'pause_validations',
        event_id: status.event_id,
      }),
    },
    token,
  );

  assert(
    pauseResponse.status === 200,
    `pause_validations action failed: ${JSON.stringify(pauseResponse.body)}`,
  );
  assert(
    pauseResponse.body.data.operational_flags.validations_paused === true,
    'validations should be paused after toggle',
  );

  const alertResponse = await api(
    '/staff/supervisor/system-status/actions',
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_SUPERVISOR_PIN,
        action: 'staff_alert',
        event_id: status.event_id,
        notes: 'E2E test alert',
      }),
    },
    token,
  );

  assert(
    alertResponse.status === 200,
    `staff_alert action failed: ${JSON.stringify(alertResponse.body)}`,
  );

  const refreshed = await api(
    `/staff/supervisor/system-status?event_id=${encodeURIComponent(status.event_id)}`,
    {},
    token,
  );

  assert(refreshed.status === 200, `Refresh failed: ${JSON.stringify(refreshed.body)}`);
  assert(
    refreshed.body.data.logs.some(
      (log: { kind: string }) => log.kind === 'staff_alert' || log.kind === 'offline_activated',
    ),
    'Expected recent system logs after actions',
  );

  await prisma.supervisorOperationalState.updateMany({
    where: { eventId: status.event_id },
    data: {
      offlineModeEnabled: false,
      validationsPaused: false,
      vipAccessBlocked: false,
    },
  });

  console.log('PASS staff system status E2E');
}

main()
  .catch((error) => {
    console.error('FAIL', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
