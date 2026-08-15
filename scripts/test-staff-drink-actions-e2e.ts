/**
 * Verify bar supervisor drink actions + action history E2E.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-drink-actions-e2e.ts
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
const TEST_PIN = process.env.SUPERVISOR_TEST_PIN ?? '1234';

let passed = 0;
function pass(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

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
    body: JSON.stringify({ phone: STAFF_PHONE, country_code: STAFF_COUNTRY }),
  });
  const otp = sendCode.body?.data?.dev_otp_code ?? process.env.DEV_OTP_CODE;
  const login = await api('/staff-auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
      code: String(otp),
    }),
  });
  return login.body.data.access_token as string;
}

async function ensureBarSupervisor(staffMemberId: string) {
  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      supervisorPinHash: await hashOtp(TEST_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(TEST_PIN),
      permissionIds: { set: ['scan_products', 'bar_supervisor', 'general_admin'] },
    },
  });
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
    select: { id: true },
  });
  if (!staffMember) {
    console.log('SKIP: staff not found');
    process.exit(0);
  }

  await ensureBarSupervisor(staffMember.id);
  const token = await staffLogin();
  pass('staff login');

  const pending = await prisma.eventDrinkRedemption.findFirst({
    where: { validatedAt: null, order: { status: 'confirmed' } },
    include: { order: { select: { eventId: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!pending) {
    console.log('SKIP: no pending drink redemption');
    process.exit(0);
  }

  const authorize = await api(
    `/staff/supervisor/drinks/${pending.id}/manual-validation`,
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_PIN,
        action: 'authorize_consumption',
        reason: 'damaged_qr',
        notes: 'E2E authorize consumption',
      }),
    },
    token,
  );
  if (authorize.status !== 200 || !authorize.body?.success) {
    throw new Error(`authorize failed: ${JSON.stringify(authorize.body)}`);
  }
  pass('POST manual-validation authorize_consumption');

  const revert = await api(
    `/staff/supervisor/drinks/${pending.id}/cancellations`,
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_PIN,
        action: 'revert_validation',
        notes: 'E2E revert validation',
      }),
    },
    token,
  );
  if (revert.status !== 200 || !revert.body?.success) {
    throw new Error(`revert failed: ${JSON.stringify(revert.body)}`);
  }
  pass('POST cancellation revert_validation');

  const release = await api(
    `/staff/supervisor/drinks/${pending.id}/override`,
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_PIN,
        action: 'release_qr',
        notes: 'E2E release qr',
      }),
    },
    token,
  );
  if (release.status !== 200 || !release.body?.success) {
    throw new Error(`override failed: ${JSON.stringify(release.body)}`);
  }
  pass('POST override release_qr');

  const history = await api(
    `/staff/supervisor/drinks/action-history?limit=10&event_id=${encodeURIComponent(pending.order.eventId)}`,
    {},
    token,
  );
  if (history.status !== 200 || !history.body?.success) {
    throw new Error(`history failed: ${JSON.stringify(history.body)}`);
  }
  const actions = history.body.data?.actions;
  if (!Array.isArray(actions) || actions.length < 3) {
    throw new Error(`expected >= 3 history rows, got ${actions?.length ?? 0}`);
  }
  pass(`GET drink action-history -> ${actions.length} action(s)`);

  console.log(`\nPASS: bar drink actions E2E (${passed} checks)`);
}

main().catch((error) => {
  console.error('\nFAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
