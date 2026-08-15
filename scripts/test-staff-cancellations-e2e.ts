/**
 * Verify all 3 bar supervisor cancellation actions E2E.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-cancellations-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';

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
  if (!login.body?.data?.access_token) {
    throw new Error(`staff login failed: ${JSON.stringify(login.body)}`);
  }
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

async function postCancellation(
  token: string,
  redemptionId: string,
  action: string,
  notes: string,
) {
  return api(
    `/staff/supervisor/drinks/${redemptionId}/cancellations`,
    {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN, action, notes }),
    },
    token,
  );
}

async function findConfirmedRedemption(excludeIds: string[] = []) {
  return prisma.eventDrinkRedemption.findFirst({
    where: {
      id: excludeIds.length ? { notIn: excludeIds } : undefined,
      order: { status: 'confirmed' },
    },
    include: { order: { select: { id: true, status: true, eventId: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function findPendingRedemption(excludeIds: string[] = []) {
  const redemption = await findConfirmedRedemption(excludeIds);
  return redemption?.validatedAt == null ? redemption : null;
}

async function testCancelConsumption(token: string) {
  const redemption = await findPendingRedemption();
  if (!redemption) {
    console.log('  ~ SKIP cancel_consumption (no pending redemption)');
    return null;
  }

  const response = await postCancellation(
    token,
    redemption.id,
    'cancel_consumption',
    'E2E cancel consumption',
  );
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`cancel_consumption failed: ${JSON.stringify(response.body)}`);
  }

  const order = await prisma.eventDrinkOrder.findUnique({
    where: { id: redemption.orderId },
    select: { status: true },
  });
  if (order?.status !== 'cancelled') {
    throw new Error(`expected order cancelled, got ${order?.status}`);
  }
  pass('POST cancellation cancel_consumption -> order cancelled');
  return redemption.id;
}

async function testRevertValidation(token: string, excludeIds: string[]) {
  const redemption = await findPendingRedemption(excludeIds);
  if (!redemption) {
    console.log('  ~ SKIP revert_validation (no pending redemption)');
    return null;
  }

  const authorize = await api(
    `/staff/supervisor/drinks/${redemption.id}/manual-validation`,
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_PIN,
        action: 'authorize_consumption',
        reason: 'damaged_qr',
        notes: 'E2E setup for revert_validation',
      }),
    },
    token,
  );
  if (authorize.status !== 200 || !authorize.body?.success) {
    throw new Error(`setup authorize failed: ${JSON.stringify(authorize.body)}`);
  }

  const validated = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    select: { validatedAt: true },
  });
  if (!validated?.validatedAt) {
    throw new Error('expected validatedAt after authorize');
  }

  const response = await postCancellation(
    token,
    redemption.id,
    'revert_validation',
    'E2E revert validation',
  );
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`revert_validation failed: ${JSON.stringify(response.body)}`);
  }

  const reverted = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    select: { validatedAt: true },
  });
  if (reverted?.validatedAt != null) {
    throw new Error('expected validatedAt cleared after revert');
  }
  pass('POST cancellation revert_validation -> validatedAt cleared');
  return redemption.id;
}

async function testReleaseBlockedQr(token: string, preferredRedemptionId?: string | null) {
  const redemption = preferredRedemptionId
    ? await prisma.eventDrinkRedemption.findFirst({
        where: { id: preferredRedemptionId, order: { status: 'confirmed' } },
        include: { order: { select: { id: true, status: true, eventId: true } } },
      })
    : await findConfirmedRedemption();
  if (!redemption) {
    console.log('  ~ SKIP release_blocked_qr (no pending redemption)');
    return null;
  }

  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
    select: { id: true },
  });
  if (!staffMember) {
    throw new Error('staff member not found');
  }

  await prisma.staffScanLog.create({
    data: {
      staffMemberId: staffMember.id,
      scanType: 'product',
      outcome: 'already_used',
      guestName: 'E2E Guest',
      itemName: 'Duplicate scan',
      eventTitle: 'E2E Event',
      entryId: redemption.manualEntryId,
      transactionId: redemption.orderId,
      qrPayload: redemption.qrPayload,
    },
  });

  const detailBefore = await api(`/staff/supervisor/drinks/${redemption.id}`, {}, token);
  if (detailBefore.status !== 200 || !detailBefore.body?.success) {
    throw new Error(`detail before release failed: ${JSON.stringify(detailBefore.body)}`);
  }
  if (!detailBefore.body.data?.is_blocked) {
    throw new Error('expected is_blocked=true before release_blocked_qr');
  }

  const response = await postCancellation(
    token,
    redemption.id,
    'release_blocked_qr',
    'E2E release blocked qr',
  );
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`release_blocked_qr failed: ${JSON.stringify(response.body)}`);
  }

  const duplicateCount = await prisma.staffScanLog.count({
    where: {
      entryId: redemption.manualEntryId,
      scanType: 'product',
      outcome: 'already_used',
    },
  });
  if (duplicateCount !== 0) {
    throw new Error(`expected duplicate logs cleared, found ${duplicateCount}`);
  }

  const detailAfter = await api(`/staff/supervisor/drinks/${redemption.id}`, {}, token);
  if (detailAfter.status !== 200 || !detailAfter.body?.success) {
    throw new Error(`detail after release failed: ${JSON.stringify(detailAfter.body)}`);
  }
  if (detailAfter.body.data?.is_blocked) {
    throw new Error('expected is_blocked=false after release_blocked_qr');
  }
  pass('POST cancellation release_blocked_qr -> duplicate logs cleared, unblocked');
  return redemption.id;
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
    select: { id: true },
  });
  if (!staffMember) {
    console.log('SKIP: Test Bar staff not found (+56912345678)');
    process.exit(0);
  }

  await ensureBarSupervisor(staffMember.id);
  const token = await staffLogin();
  pass('staff login');

  const usedIds: string[] = [];
  const cancelledId = await testCancelConsumption(token);
  if (cancelledId) usedIds.push(cancelledId);

  const revertedId = await testRevertValidation(token, usedIds);
  if (revertedId) usedIds.push(revertedId);

  const releasedId = await testReleaseBlockedQr(token, revertedId);
  if (releasedId) usedIds.push(releasedId);

  if (passed < 4) {
    throw new Error(`expected at least 4 checks (login + 3 actions), got ${passed}`);
  }

  console.log(`\nPASS: all cancellation actions E2E (${passed} checks)`);
}

main().catch((error) => {
  console.error('\nFAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
