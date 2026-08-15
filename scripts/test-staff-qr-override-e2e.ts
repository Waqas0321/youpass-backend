/**
 * Verify all 5 bar supervisor QR override actions E2E.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-qr-override-e2e.ts
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

async function postOverride(
  token: string,
  redemptionId: string,
  action: string,
  notes: string,
) {
  return api(
    `/staff/supervisor/drinks/${redemptionId}/override`,
    {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN, action, notes }),
    },
    token,
  );
}

async function authorizeConsumption(token: string, redemptionId: string) {
  return api(
    `/staff/supervisor/drinks/${redemptionId}/manual-validation`,
    {
      method: 'POST',
      body: JSON.stringify({
        pin: TEST_PIN,
        action: 'authorize_consumption',
        reason: 'damaged_qr',
        notes: 'E2E setup authorize',
      }),
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
    orderBy: { createdAt: 'desc' },
  });
}

async function findPendingRedemption(excludeIds: string[] = []) {
  const redemption = await findConfirmedRedemption(excludeIds);
  return redemption?.validatedAt == null ? redemption : null;
}

async function addDuplicateLog(staffMemberId: string, redemption: { manualEntryId: string; orderId: string; qrPayload: string }) {
  await prisma.staffScanLog.create({
    data: {
      staffMemberId,
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
}

async function testReleaseQr(token: string, staffMemberId: string, excludeIds: string[]) {
  const redemption = await findConfirmedRedemption(excludeIds);
  if (!redemption) {
    console.log('  ~ SKIP release_qr (no confirmed redemption)');
    return null;
  }

  await addDuplicateLog(staffMemberId, redemption);

  const response = await postOverride(token, redemption.id, 'release_qr', 'E2E release qr');
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`release_qr failed: ${JSON.stringify(response.body)}`);
  }

  const duplicateCount = await prisma.staffScanLog.count({
    where: {
      entryId: redemption.manualEntryId,
      scanType: 'product',
      outcome: 'already_used',
    },
  });
  if (duplicateCount !== 0) {
    throw new Error(`release_qr: expected duplicate logs cleared, found ${duplicateCount}`);
  }
  pass('POST override release_qr -> duplicate logs cleared');
  return redemption.id;
}

async function testRevalidateQr(token: string, excludeIds: string[]) {
  const redemption = await findPendingRedemption(excludeIds);
  if (!redemption) {
    console.log('  ~ SKIP revalidate_qr (no pending redemption)');
    return null;
  }

  const response = await postOverride(token, redemption.id, 'revalidate_qr', 'E2E revalidate qr');
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`revalidate_qr failed: ${JSON.stringify(response.body)}`);
  }

  const updated = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    select: { validatedAt: true },
  });
  if (!updated?.validatedAt) {
    throw new Error('revalidate_qr: expected validatedAt set');
  }
  pass('POST override revalidate_qr -> validatedAt set');
  return redemption.id;
}

async function testRevertValidation(token: string, excludeIds: string[]) {
  const redemption = await findPendingRedemption(excludeIds);
  if (!redemption) {
    console.log('  ~ SKIP revert_validation (no pending redemption)');
    return null;
  }

  const authorize = await authorizeConsumption(token, redemption.id);
  if (authorize.status !== 200 || !authorize.body?.success) {
    throw new Error(`setup authorize failed: ${JSON.stringify(authorize.body)}`);
  }

  const response = await postOverride(
    token,
    redemption.id,
    'revert_validation',
    'E2E override revert validation',
  );
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`revert_validation failed: ${JSON.stringify(response.body)}`);
  }

  const updated = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    select: { validatedAt: true },
  });
  if (updated?.validatedAt != null) {
    throw new Error('revert_validation: expected validatedAt cleared');
  }
  pass('POST override revert_validation -> validatedAt cleared');
  return redemption.id;
}

async function testAuthorizeReconsumption(
  token: string,
  staffMemberId: string,
  excludeIds: string[],
) {
  const redemption = await findPendingRedemption(excludeIds);
  if (!redemption) {
    console.log('  ~ SKIP authorize_reconsumption (no pending redemption)');
    return null;
  }

  const authorize = await authorizeConsumption(token, redemption.id);
  if (authorize.status !== 200 || !authorize.body?.success) {
    throw new Error(`setup authorize failed: ${JSON.stringify(authorize.body)}`);
  }
  await addDuplicateLog(staffMemberId, redemption);

  const response = await postOverride(
    token,
    redemption.id,
    'authorize_reconsumption',
    'E2E authorize re-consumption',
  );
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`authorize_reconsumption failed: ${JSON.stringify(response.body)}`);
  }

  const updated = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    select: { validatedAt: true },
  });
  const duplicateCount = await prisma.staffScanLog.count({
    where: {
      entryId: redemption.manualEntryId,
      scanType: 'product',
      outcome: 'already_used',
    },
  });
  if (updated?.validatedAt != null) {
    throw new Error('authorize_reconsumption: expected validatedAt cleared');
  }
  if (duplicateCount !== 0) {
    throw new Error('authorize_reconsumption: expected duplicate logs cleared');
  }
  pass('POST override authorize_reconsumption -> reset + duplicates cleared');
  return redemption.id;
}

async function testTemporaryUnlock(token: string, excludeIds: string[]) {
  const redemption = await findPendingRedemption(excludeIds);
  if (!redemption) {
    console.log('  ~ SKIP temporary_unlock (no pending redemption)');
    return null;
  }

  const before = redemption.unlockAt;
  const response = await postOverride(
    token,
    redemption.id,
    'temporary_unlock',
    'E2E temporary unlock',
  );
  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`temporary_unlock failed: ${JSON.stringify(response.body)}`);
  }

  const updated = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    select: { unlockAt: true },
  });
  if (!updated || updated.unlockAt.getTime() <= before.getTime()) {
    throw new Error('temporary_unlock: expected unlockAt refreshed');
  }
  pass('POST override temporary_unlock -> unlockAt refreshed');
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

  for (const run of [
    () => testReleaseQr(token, staffMember.id, usedIds),
    () => testRevalidateQr(token, usedIds),
    () => testRevertValidation(token, usedIds),
    () => testAuthorizeReconsumption(token, staffMember.id, usedIds),
    () => testTemporaryUnlock(token, usedIds),
  ]) {
    const id = await run();
    if (id) usedIds.push(id);
  }

  if (passed < 6) {
    throw new Error(`expected at least 6 checks (login + 5 actions), got ${passed}`);
  }

  console.log(`\nPASS: all QR override actions E2E (${passed} checks)`);
}

main().catch((error) => {
  console.error('\nFAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
