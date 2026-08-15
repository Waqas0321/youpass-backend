/**
 * Verify supervisor search entry E2E:
 * search, filters, detail, history, and action endpoints.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-entry-search-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '987654321';
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

async function ensureTicketsSupervisor(staffMemberId: string) {
  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      supervisorPinHash: await hashOtp(TEST_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(TEST_PIN),
      permissionIds: { set: ['scan_tickets', 'tickets_supervisor', 'general_admin'] },
    },
  });
}

function assertSearchResultShape(result: Record<string, unknown>, label: string) {
  const required = [
    'ticket_id',
    'guest_name',
    'qr_id',
    'purchase_id',
    'status',
    'associated_entries_label',
  ];
  for (const key of required) {
    if (!(key in result)) {
      throw new Error(`${label}: missing field ${key}`);
    }
  }
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56987654321' },
    select: { id: true },
  });
  if (!staffMember) {
    console.log('SKIP: Test Tickets staff not found (+56987654321)');
    process.exit(0);
  }

  const sampleTicket = await prisma.invitationTicket.findFirst({
    where: {
      invitation: {
        status: { in: ['accepted', 'validated'] },
      },
    },
    include: {
      invitation: {
        include: {
          recipient: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!sampleTicket) {
    console.log('SKIP: no invitation ticket in database');
    process.exit(0);
  }

  await ensureTicketsSupervisor(staffMember.id);
  const token = await staffLogin();
  pass('tickets supervisor login');

  const guestName =
    sampleTicket.invitation.recipient?.fullName ??
    sampleTicket.invitation.recipientName ??
    'Guest';
  const entryCode = sampleTicket.manualEntryId;
  const guestQuery = guestName.split(/\s+/)[0] ?? guestName;

  const searchByCode = await api(
    `/staff/supervisor/entries/search?q=${encodeURIComponent(entryCode)}`,
    {},
    token,
  );
  if (searchByCode.status !== 200 || !searchByCode.body?.success) {
    throw new Error(`search by code failed: ${JSON.stringify(searchByCode.body)}`);
  }
  const codeResults = searchByCode.body.data?.results ?? [];
  if (!Array.isArray(codeResults) || codeResults.length < 1) {
    throw new Error(`expected >=1 result for entry code ${entryCode}`);
  }
  assertSearchResultShape(codeResults[0], 'search by code');
  pass(`GET search by QR/entry code (${entryCode}) -> ${codeResults.length} result(s)`);

  const searchByName = await api(
    `/staff/supervisor/entries/search?q=${encodeURIComponent(guestQuery)}`,
    {},
    token,
  );
  if (searchByName.status !== 200 || !searchByName.body?.success) {
    throw new Error(`search by name failed: ${JSON.stringify(searchByName.body)}`);
  }
  pass(`GET search by guest name (${guestQuery})`);

  for (const filter of ['vip', 'used', 'error'] as const) {
    const filtered = await api(
      `/staff/supervisor/entries/search?filter=${filter}`,
      {},
      token,
    );
    if (filtered.status !== 200 || !filtered.body?.success) {
      throw new Error(`filter=${filter} failed: ${JSON.stringify(filtered.body)}`);
    }
    const results = filtered.body.data?.results ?? [];
    if (!Array.isArray(results)) {
      throw new Error(`filter=${filter}: results not array`);
    }
    for (const row of results.slice(0, 3)) {
      assertSearchResultShape(row, `filter=${filter}`);
      if (filter === 'vip' && row.is_vip !== true) {
        throw new Error(`filter=vip returned non-vip ticket ${row.ticket_id}`);
      }
      if (filter === 'used' && row.status !== 'validated') {
        throw new Error(`filter=used returned non-validated ticket ${row.ticket_id}`);
      }
      if (filter === 'error' && row.status !== 'error') {
        throw new Error(`filter=error returned non-error ticket ${row.ticket_id}`);
      }
    }
    pass(`GET search filter=${filter} -> ${results.length} result(s)`);
  }

  const ticketId = codeResults[0].ticket_id as string;

  const detail = await api(`/staff/supervisor/entries/${ticketId}`, {}, token);
  if (detail.status !== 200 || !detail.body?.success) {
    throw new Error(`entry detail failed: ${JSON.stringify(detail.body)}`);
  }
  const detailData = detail.body.data;
  if (!detailData?.guest_name || !detailData?.qr_id) {
    throw new Error('entry detail missing guest_name or qr_id');
  }
  if (!Array.isArray(detailData.recent_events)) {
    throw new Error('entry detail missing recent_events array');
  }
  pass(`GET entry detail (${detailData.guest_name})`);

  const history = await api(`/staff/supervisor/entries/${ticketId}/history`, {}, token);
  if (history.status !== 200 || !history.body?.success) {
    throw new Error(`entry history failed: ${JSON.stringify(history.body)}`);
  }
  if (!Array.isArray(history.body.data?.events)) {
    throw new Error('entry history missing events array');
  }
  pass(`GET entry history -> ${history.body.data.events.length} event(s)`);

  const overrideContext = await api(
    `/staff/supervisor/entries/${ticketId}/override`,
    {},
    token,
  );
  if (overrideContext.status !== 200 || !overrideContext.body?.success) {
    throw new Error(`override context failed: ${JSON.stringify(overrideContext.body)}`);
  }
  pass('GET entry override context (Revalidate / Release QR)');

  const manualContext = await api(
    `/staff/supervisor/entries/${ticketId}/manual-validation`,
    {},
    token,
  );
  if (manualContext.status !== 200 || !manualContext.body?.success) {
    throw new Error(`manual validation context failed: ${JSON.stringify(manualContext.body)}`);
  }
  pass('GET entry manual validation context (Manual override)');

  console.log(`\nPASS: supervisor search entry E2E (${passed} checks)`);
}

main()
  .catch((error) => {
    console.error('\nFAIL:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
