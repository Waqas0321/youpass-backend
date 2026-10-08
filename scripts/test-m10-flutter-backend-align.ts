/**
 * Cross-verify Flutter-style HMAC signing against backend verify().
 * Also hits live /staff/scan/sync with a Flutter-shaped payload.
 *
 * Run: API_BASE=… PORT=3002 npx tsx scripts/test-m10-flutter-backend-align.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../src/config/database.js';
import { STAFF_PERMISSIONS } from '../src/modules/admin/admin-staff.constants.js';
import { findInvitationTicketByScanInput } from '../src/modules/invitations/invitation-ticket-scan.utils.js';
import {
  buildOfflineScanCanonical,
  signOfflineScan,
  verifyOfflineScanHmac,
} from '../src/modules/staff-scan/staff-offline-hmac.js';

const API =
  process.env.API_BASE ??
  `http://localhost:${process.env.PORT ?? '3002'}/api/v1`;
const STAFF_PHONE = process.env.STAFF_TEST_PHONE ?? '912345678';
const STAFF_E164 = process.env.STAFF_TEST_E164 ?? '+56912345678';
const STAFF_COUNTRY = process.env.STAFF_TEST_COUNTRY ?? 'CL';

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`PASS  ${label}`);
}

function fail(label: string, detail?: unknown) {
  failed += 1;
  console.error(`FAIL  ${label}`);
  if (detail !== undefined) console.error(detail);
}

/** Exact Flutter `signOfflineScan` algorithm (crypto package hex digest). */
function flutterSignOfflineScan(
  signingSecret: string,
  input: {
    clientScanId: string;
    scanType: string;
    qrPayload: string;
    scannedAtIso: string;
    deviceId: string;
  },
): string {
  const canonical = [
    'v1',
    input.clientScanId,
    input.scanType,
    input.qrPayload,
    input.scannedAtIso,
    input.deviceId,
  ].join('|');
  return crypto.createHmac('sha256', signingSecret).update(canonical).digest('hex');
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

async function staffLogin() {
  await prisma.staffMember.updateMany({
    where: { phone: STAFF_E164 },
    data: { permissionIds: STAFF_PERMISSIONS.map((p) => p.id) },
  });

  const sendCode = await api('/staff-auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone: STAFF_PHONE, country_code: STAFF_COUNTRY }),
  });
  const otp =
    sendCode.body?.data?.dev_otp_code ??
    sendCode.body?.data?.code ??
    process.env.DEV_OTP_CODE ??
    process.env.PLAY_REVIEW_OTP;
  if (!otp) throw new Error(`No OTP: ${JSON.stringify(sendCode.body)}`);

  const login = await api('/staff-auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
      code: String(otp),
    }),
  });
  if (login.status !== 200 || !login.body?.success) {
    throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  }
  return {
    token: login.body.data.access_token as string,
    offlineSecret: login.body.data.offline_signing_secret as string,
  };
}

async function findEntryCode() {
  const rows = await prisma.invitationTicket.findMany({
    select: { manualEntryId: true },
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

async function main() {
  console.log('API:', API);

  // Pure crypto alignment (no network)
  const secret = 'align-secret-for-flutter-backend-m10!!';
  const vector = {
    clientScanId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    scanType: 'product',
    qrPayload: 'YP-PRODUCT-ALIGN',
    scannedAt: '2026-09-24T01:00:00.123Z',
    deviceId: 'flutter-device-00123456',
  };

  const backendHmac = signOfflineScan(secret, vector);
  const flutterHmac = flutterSignOfflineScan(secret, {
    clientScanId: vector.clientScanId,
    scanType: vector.scanType,
    qrPayload: vector.qrPayload,
    scannedAtIso: vector.scannedAt,
    deviceId: vector.deviceId,
  });

  if (backendHmac === flutterHmac) {
    pass('Flutter HMAC === backend signOfflineScan');
  } else {
    fail('Flutter HMAC === backend signOfflineScan', { backendHmac, flutterHmac });
  }

  if (
    verifyOfflineScanHmac(secret, vector, flutterHmac) &&
    verifyOfflineScanHmac(secret, vector, flutterHmac.toUpperCase())
  ) {
    pass('backend verify accepts Flutter HMAC (case-insensitive)');
  } else {
    fail('backend verify accepts Flutter HMAC');
  }

  const canonical = buildOfflineScanCanonical(vector);
  if (canonical === `v1|${vector.clientScanId}|${vector.scanType}|${vector.qrPayload}|${vector.scannedAt}|${vector.deviceId}`) {
    pass('canonical string matches Flutter join order');
  } else {
    fail('canonical string matches Flutter join order', canonical);
  }

  // Live sync with Flutter-shaped body
  const { token, offlineSecret } = await staffLogin();
  if (offlineSecret?.length >= 32) {
    pass('login offline_signing_secret present for app storage');
  } else {
    fail('login offline_signing_secret present for app storage');
  }

  const deviceId = `flutter-align-${crypto.randomBytes(4).toString('hex')}`;
  const entryCode = await findEntryCode();
  if (!entryCode) {
    console.log('SKIP  live Flutter-shaped sync — no entry ticket');
  } else {
    const clientScanId = crypto.randomUUID();
    const scannedAtIso = new Date().toISOString();
    const hmac = flutterSignOfflineScan(offlineSecret, {
      clientScanId,
      scanType: 'entry',
      qrPayload: entryCode,
      scannedAtIso,
      deviceId,
    });

    // Exact JSON keys the Flutter app sends
    const flutterBody = {
      device_id: deviceId,
      scans: [
        {
          client_scan_id: clientScanId,
          scan_type: 'entry',
          qr_payload: entryCode,
          scanned_at: scannedAtIso,
          hmac,
        },
      ],
    };

    const sync = await api('/staff/scan/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(flutterBody),
    });

    const status = sync.body?.data?.results?.[0]?.status;
    if (
      sync.status === 200 &&
      (status === 'applied' || status === 'already_used' || status === 'duplicate_client_id')
    ) {
      pass(`Flutter-shaped /staff/scan/sync → ${status}`);
    } else {
      fail('Flutter-shaped /staff/scan/sync', sync);
    }

    // Endpoint + field contract smoke
    if (Array.isArray(sync.body?.data?.results) && typeof sync.body?.data?.synced_count === 'number') {
      pass('sync response shape { synced_count, results[] }');
    } else {
      fail('sync response shape', sync.body);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
