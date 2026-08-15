/**
 * Comprehensive supervisor drink search E2E:
 * GET /staff/supervisor/drinks/search
 * GET /staff/supervisor/drinks/:redemptionId
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-drink-search-e2e.ts
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

const SUMMARY_FIELDS = [
  'redemption_id',
  'order_id',
  'line_id',
  'guest_name',
  'product_name',
  'product_quantity',
  'qr_id',
  'qr_payload',
  'order_code',
  'consumption_id',
  'status',
  'is_validated',
  'is_blocked',
  'event_id',
  'event_title',
  'recent_events',
] as const;

const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  'last_id_digits',
  'is_document_confirmed',
  'is_qr_unavailable',
] as const;

const VALID_STATUSES = new Set(['validated', 'pending', 'cancelled', 'blocked', 'error']);

let passed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
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

async function ensureBarSupervisorPin(staffMemberId: string) {
  if (TEST_SUPERVISOR_PIN.length !== SUPERVISOR_PIN_LENGTH) {
    throw new Error(`SUPERVISOR_TEST_PIN must be ${SUPERVISOR_PIN_LENGTH} digits`);
  }

  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      supervisorPinHash: await hashOtp(TEST_SUPERVISOR_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(TEST_SUPERVISOR_PIN),
      permissionIds: {
        set: ['scan_products', 'bar_supervisor', 'general_admin'],
      },
    },
  });
}

async function ensureTicketsOnlyPin(staffMemberId: string) {
  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      permissionIds: {
        set: ['scan_tickets', 'tickets_supervisor'],
      },
    },
  });
}

function assertSummaryShape(item: Record<string, unknown>, label: string) {
  for (const field of SUMMARY_FIELDS) {
    assert(field in item, `${label}: missing field "${field}"`);
  }

  assert(typeof item.redemption_id === 'string' && item.redemption_id.length > 0, `${label}: redemption_id`);
  assert(typeof item.guest_name === 'string', `${label}: guest_name`);
  assert(typeof item.product_name === 'string', `${label}: product_name`);
  assert(typeof item.product_quantity === 'number', `${label}: product_quantity`);
  assert(VALID_STATUSES.has(String(item.status)), `${label}: invalid status ${item.status}`);
  assert(Array.isArray(item.recent_events), `${label}: recent_events must be array`);
}

function assertDetailShape(item: Record<string, unknown>, label: string) {
  assertSummaryShape(item, label);

  for (const field of DETAIL_FIELDS) {
    assert(field in item, `${label}: missing detail field "${field}"`);
  }

  assert(typeof item.last_id_digits === 'string', `${label}: last_id_digits`);
  assert(typeof item.is_document_confirmed === 'boolean', `${label}: is_document_confirmed`);
  assert(typeof item.is_qr_unavailable === 'boolean', `${label}: is_qr_unavailable`);
}

async function testAuthAndValidation(token: string) {
  const noAuth = await api('/staff/supervisor/drinks/search?q=test');
  assert(noAuth.status === 401, `Expected 401 without auth, got ${noAuth.status}`);
  pass('rejects unauthenticated search');

  const emptyQuery = await api('/staff/supervisor/drinks/search', {}, token);
  assert(emptyQuery.status === 400, `Expected 400 for empty query, got ${emptyQuery.status}`);
  pass('rejects search without q or filter');

  const notFound = await api('/staff/supervisor/drinks/nonexistent-redemption-id', {}, token);
  assert(notFound.status === 404, `Expected 404 for missing redemption, got ${notFound.status}`);
  assert(notFound.body?.error?.code === 'DRINK_REDEMPTION_NOT_FOUND', 'Expected DRINK_REDEMPTION_NOT_FOUND');
  pass('returns 404 for unknown redemption id');
}

async function testPermissionDenied(staffMemberId: string) {
  await ensureTicketsOnlyPin(staffMemberId);
  const token = await staffLogin();

  const denied = await api('/staff/supervisor/drinks/search?q=test', {}, token);
  assert(denied.status === 403, `Expected 403 without bar_supervisor, got ${denied.status}`);
  pass('rejects staff without bar_supervisor permission');

  await ensureBarSupervisorPin(staffMemberId);
}

async function testSearchModes(
  token: string,
  sample: {
    manualEntryId: string;
    qrPayload: string;
    productName: string;
    guestFirstName: string;
    orderId: string;
  },
) {
  const shortQuery = await api(
    `/staff/supervisor/drinks/search?q=${encodeURIComponent('Te')}`,
    {},
    token,
  );
  assert(shortQuery.status === 200 && shortQuery.body?.success, `Short query failed: ${JSON.stringify(shortQuery.body)}`);
  assert(Array.isArray(shortQuery.body.data?.results), 'Short query must return results array');
  pass('short query "Te" returns 200 (no server crash)');

  const guestSearch = await api(
    `/staff/supervisor/drinks/search?q=${encodeURIComponent(sample.guestFirstName)}`,
    {},
    token,
  );
  assert(guestSearch.status === 200 && guestSearch.body?.success, 'Guest name search failed');
  assert(guestSearch.body.data.results.length > 0, 'Guest name search returned no results');
  assertSummaryShape(guestSearch.body.data.results[0], 'guest search result');
  pass(`guest name search "${sample.guestFirstName}" -> ${guestSearch.body.data.results.length} result(s)`);

  const qrSearch = await api(
    `/staff/supervisor/drinks/search?q=${encodeURIComponent(sample.manualEntryId)}`,
    {},
    token,
  );
  assert(qrSearch.status === 200 && qrSearch.body?.success, 'Manual entry id search failed');
  assert(
    qrSearch.body.data.results.some(
      (row: { qr_id?: string }) => row.qr_id === sample.manualEntryId,
    ),
    'Manual entry id search did not return matching redemption',
  );
  pass(`manual entry id search "${sample.manualEntryId}"`);

  if (sample.qrPayload && sample.qrPayload !== sample.manualEntryId) {
    const payloadSearch = await api(
      `/staff/supervisor/drinks/search?q=${encodeURIComponent(sample.qrPayload)}`,
      {},
      token,
    );
    assert(payloadSearch.status === 200 && payloadSearch.body?.success, 'QR payload search failed');
    pass('qr payload search');
  }

  const productTerm = sample.productName.split(' ')[0]?.slice(0, 4) ?? sample.productName.slice(0, 4);
  if (productTerm.length >= 3) {
    const productSearch = await api(
      `/staff/supervisor/drinks/search?q=${encodeURIComponent(productTerm)}`,
      {},
      token,
    );
    assert(productSearch.status === 200 && productSearch.body?.success, 'Product search failed');
    assert(productSearch.body.data.results.length > 0, 'Product search returned no results');
    pass(`product search "${productTerm}" -> ${productSearch.body.data.results.length} result(s)`);
  }

  const orderCode = `DRK-${sample.orderId.slice(-6).toUpperCase()}`;
  const orderSearch = await api(
    `/staff/supervisor/drinks/search?q=${encodeURIComponent(orderCode)}`,
    {},
    token,
  );
  assert(orderSearch.status === 200 && orderSearch.body?.success, 'Order code search failed');
  assert(orderSearch.body.data.results.length > 0, `Order code search for ${orderCode} returned no results`);
  pass(`order code search "${orderCode}"`);
}

async function testFilters(token: string) {
  for (const filter of ['validated', 'pending', 'cancelled', 'duplicate'] as const) {
    const response = await api(`/staff/supervisor/drinks/search?filter=${filter}`, {}, token);
    assert(response.status === 200 && response.body?.success, `Filter ${filter} failed: ${JSON.stringify(response.body)}`);
    assert(Array.isArray(response.body.data?.results), `Filter ${filter} must return results array`);
    assert(typeof response.body.data.total === 'number', `Filter ${filter} must return total`);

    for (const row of response.body.data.results.slice(0, 3)) {
      assertSummaryShape(row, `filter:${filter}`);
    }

    pass(`filter "${filter}" -> ${response.body.data.results.length} result(s)`);
  }
}

async function testDetailEndpoint(token: string, redemptionId: string) {
  const detailResponse = await api(
    `/staff/supervisor/drinks/${encodeURIComponent(redemptionId)}`,
    {},
    token,
  );

  assert(detailResponse.status === 200 && detailResponse.body?.success, `Detail failed: ${JSON.stringify(detailResponse.body)}`);

  const detail = detailResponse.body.data;
  assertDetailShape(detail, 'detail');
  assert(detail.redemption_id === redemptionId, 'Detail redemption_id mismatch');
  pass(`detail ${detail.guest_name} / ${detail.product_name} (${detail.status})`);

  if (detail.recent_events.length > 0) {
    const event = detail.recent_events[0];
    assert(typeof event.time_label === 'string', 'recent event time_label');
    assert(typeof event.detail === 'string', 'recent event detail');
    pass(`detail includes ${detail.recent_events.length} recent event(s)`);
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

  await ensureBarSupervisorPin(staffMember.id);

  const sampleRedemption = await prisma.eventDrinkRedemption.findFirst({
    where: {
      order: {
        status: { in: ['confirmed', 'redeemed'] },
      },
    },
    include: {
      line: { select: { productName: true } },
      order: {
        include: {
          user: { select: { fullName: true } },
          lines: { select: { productName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!sampleRedemption) {
    console.log('SKIP: No drink redemption found in database.');
    process.exit(0);
  }

  const productName =
    sampleRedemption.line?.productName ??
    sampleRedemption.order.lines[0]?.productName ??
    'Drink';

  const guestFirstName = sampleRedemption.order.user.fullName.split(' ')[0] ?? 'Test';

  console.log('Running supervisor drink search E2E...\n');

  const token = await staffLogin();
  pass('staff login');

  await testAuthAndValidation(token);
  await testPermissionDenied(staffMember.id);

  const barToken = await staffLogin();
  pass('restored bar_supervisor permissions');

  await testSearchModes(barToken, {
    manualEntryId: sampleRedemption.manualEntryId,
    qrPayload: sampleRedemption.qrPayload,
    productName,
    guestFirstName,
    orderId: sampleRedemption.orderId,
  });

  await testFilters(barToken);
  await testDetailEndpoint(barToken, sampleRedemption.id);

  console.log(`\nPASS: staff drink search E2E (${passed} checks)`);
}

main().catch((error) => {
  console.error('\nFAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
