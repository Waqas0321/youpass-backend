/**
 * M10 offline staff scan E2E:
 * - Login returns offline_signing_secret
 * - Bad HMAC is rejected
 * - Valid HMAC offline entry sync applies (or already_used)
 * - Duplicate client_scan_id is idempotent
 * - Tampered payload is rejected
 *
 * Local:  PORT=3002 npx tsx scripts/test-m10-offline-sync-e2e.ts
 * Prod:   API_BASE=https://youpass-backend-two.vercel.app/api/v1 npx tsx scripts/test-m10-offline-sync-e2e.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../src/config/database.js';
import { STAFF_PERMISSIONS } from '../src/modules/admin/admin-staff.constants.js';
import { findInvitationTicketByScanInput } from '../src/modules/invitations/invitation-ticket-scan.utils.js';
import {
  buildOfflineScanCanonical,
  signOfflineScan,
} from '../src/modules/staff-scan/staff-offline-hmac.js';

const API =
  process.env.API_BASE ??
  `http://localhost:${process.env.PORT ?? '3002'}/api/v1`;
const STAFF_PHONE = process.env.STAFF_TEST_PHONE ?? '912345678';
const STAFF_E164 = process.env.STAFF_TEST_E164 ?? '+56912345678';
const STAFF_COUNTRY = process.env.STAFF_TEST_COUNTRY ?? 'CL';
const ALL_PERMISSION_IDS = STAFF_PERMISSIONS.map((p) => p.id);

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`PASS  ${label}`);
}

function fail(label: string, detail?: unknown) {
  failed += 1;
  console.error(`FAIL  ${label}`);
  if (detail !== undefined) {
    console.error(detail);
  }
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function ensureStaffReady() {
  const staff = await prisma.staffMember.findFirst({
    where: { phone: STAFF_E164 },
  });
  if (!staff) {
    throw new Error(`Staff ${STAFF_E164} not found — seed staff first`);
  }
  await prisma.staffMember.update({
    where: { id: staff.id },
    data: { permissionIds: { set: ALL_PERMISSION_IDS } },
  });
  return staff;
}

async function staffLogin(): Promise<{
  token: string;
  offlineSecret: string;
  sessionId: string;
}> {
  const sendCode = await api('/staff-auth/send-code', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
    }),
  });

  const otp =
    sendCode.body?.data?.dev_otp_code ??
    sendCode.body?.data?.code ??
    process.env.DEV_OTP_CODE ??
    process.env.PLAY_REVIEW_OTP;

  if (!otp) {
    throw new Error(`No OTP available: ${JSON.stringify(sendCode.body)}`);
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

  const data = login.body.data;
  const offlineSecret = data.offline_signing_secret as string | undefined;
  if (!offlineSecret || offlineSecret.length < 32) {
    throw new Error(`Missing offline_signing_secret: ${JSON.stringify(data)}`);
  }

  return {
    token: data.access_token as string,
    offlineSecret,
    sessionId: data.session_id as string,
  };
}

async function findScannableEntryCode(): Promise<string | null> {
  const rows = await prisma.invitationTicket.findMany({
    select: { manualEntryId: true, validatedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  for (const row of rows) {
    const ticket = await findInvitationTicketByScanInput(row.manualEntryId);
    if (!ticket) continue;
    const status = ticket.invitation.status;
    if (status === 'accepted' || status === 'validated') {
      return row.manualEntryId;
    }
  }
  return null;
}

function makeSignedScan(input: {
  offlineSecret: string;
  scanType: 'entry' | 'product';
  qrPayload: string;
  deviceId: string;
  clientScanId?: string;
  scannedAt?: string;
  hmacOverride?: string;
}) {
  const clientScanId = input.clientScanId ?? crypto.randomUUID();
  const scannedAt = input.scannedAt ?? new Date().toISOString();
  const hmac =
    input.hmacOverride ??
    signOfflineScan(input.offlineSecret, {
      clientScanId,
      scanType: input.scanType,
      qrPayload: input.qrPayload,
      scannedAt,
      deviceId: input.deviceId,
    });

  return {
    client_scan_id: clientScanId,
    scan_type: input.scanType,
    qr_payload: input.qrPayload,
    scanned_at: scannedAt,
    hmac,
  };
}

async function main() {
  console.log('API:', API);
  await ensureStaffReady();

  const { token, offlineSecret } = await staffLogin();
  pass('staff login returns offline_signing_secret');

  const deviceId = `e2e-device-${crypto.randomBytes(6).toString('hex')}`;
  const auth = { Authorization: `Bearer ${token}` };

  // 1) Bad HMAC rejected
  const bad = await api('/staff/scan/sync', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      device_id: deviceId,
      scans: [
        makeSignedScan({
          offlineSecret,
          scanType: 'entry',
          qrPayload: 'INVALID-QR-PAYLOAD-XXXX',
          deviceId,
          hmacOverride: '0'.repeat(64),
        }),
      ],
    }),
  });

  const badStatus = bad.body?.data?.results?.[0]?.status;
  const badCode = bad.body?.data?.results?.[0]?.error_code;
  if (bad.status === 200 && badStatus === 'rejected' && badCode === 'HMAC_INVALID') {
    pass('rejects invalid HMAC');
  } else {
    fail('rejects invalid HMAC', bad);
  }

  // 2) Canonical / signing helpers round-trip
  const sampleId = crypto.randomUUID();
  const sampleAt = new Date().toISOString();
  const samplePayload = 'SAMPLE-PAYLOAD';
  const canonical = buildOfflineScanCanonical({
    clientScanId: sampleId,
    scanType: 'entry',
    qrPayload: samplePayload,
    scannedAt: sampleAt,
    deviceId,
  });
  if (canonical.startsWith('v1|') && canonical.includes(sampleId)) {
    pass('canonical payload format v1');
  } else {
    fail('canonical payload format v1', canonical);
  }

  // 3) Real entry sync (if a ticket exists)
  const entryCode = await findScannableEntryCode();
  if (!entryCode) {
    console.log('SKIP  applied entry sync — no scannable invitation ticket in DB');
  } else {
    const signed = makeSignedScan({
      offlineSecret,
      scanType: 'entry',
      qrPayload: entryCode,
      deviceId,
    });

    const sync = await api('/staff/scan/sync', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        device_id: deviceId,
        scans: [signed],
      }),
    });

    const result = sync.body?.data?.results?.[0];
    const okStatuses = new Set(['applied', 'already_used']);
    if (sync.status === 200 && okStatuses.has(result?.status)) {
      pass(`valid HMAC entry sync → ${result.status}`);
    } else {
      fail('valid HMAC entry sync', sync);
    }

    // 4) Duplicate client_scan_id
    const dup = await api('/staff/scan/sync', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        device_id: deviceId,
        scans: [signed],
      }),
    });
    const dupStatus = dup.body?.data?.results?.[0]?.status;
    if (dup.status === 200 && dupStatus === 'duplicate_client_id') {
      pass('duplicate client_scan_id is idempotent');
    } else {
      fail('duplicate client_scan_id is idempotent', dup);
    }

    // 5) Confirm log marked synced_from_offline when applied
    if (result?.status === 'applied') {
      const log = await prisma.staffScanLog.findFirst({
        where: { clientScanId: signed.client_scan_id },
      });
      if (log?.syncedFromOffline === true && log.deviceId === deviceId) {
        pass('scan log stores syncedFromOffline + deviceId');
      } else {
        fail('scan log stores syncedFromOffline + deviceId', log);
      }
    }
  }

  // 6) Tampered qr after signing
  const tamperedBase = makeSignedScan({
    offlineSecret,
    scanType: 'entry',
    qrPayload: 'ORIGINAL-PAYLOAD-AAAA',
    deviceId,
  });
  const tampered = await api('/staff/scan/sync', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      device_id: deviceId,
      scans: [
        {
          ...tamperedBase,
          qr_payload: 'TAMPERED-PAYLOAD-BBBB',
        },
      ],
    }),
  });
  if (
    tampered.status === 200 &&
    tampered.body?.data?.results?.[0]?.status === 'rejected' &&
    tampered.body?.data?.results?.[0]?.error_code === 'HMAC_INVALID'
  ) {
    pass('rejects tampered qr_payload');
  } else {
    fail('rejects tampered qr_payload', tampered);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
