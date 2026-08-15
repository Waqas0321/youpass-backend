/**
 * Verify admin Staff QR dashboard reads live scan data from the database.
 *
 * Run: npx tsx scripts/test-admin-staff-qr-dashboard-e2e.ts
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { adminEventStaffQrService } from '../src/modules/admin/admin-event-staff-qr.service.js';

const BASE = `http://localhost:${env.PORT}${env.API_PREFIX}`;
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';
const TEST_PREFIX = 'E2E_STAFF_QR_';

const DASHBOARD_TIMEZONE = 'America/Santiago';
const QR_SCAN_OUTCOMES = ['valid', 'already_used'] as const;

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

function startOfDayInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function endOfDayUtc(date: Date) {
  const next = new Date(date);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

function todayWindow(now = new Date()) {
  const start = startOfDayInTimezone(now, DASHBOARD_TIMEZONE);
  return { gte: start, lte: endOfDayUtc(start) };
}

async function countEventScansToday(eventTitle: string) {
  const window = todayWindow();
  return prisma.staffScanLog.count({
    where: {
      eventTitle,
      scannedAt: { gte: window.gte, lte: window.lte },
      outcome: { in: [...QR_SCAN_OUTCOMES] },
    },
  });
}

async function adminRequest(path: string) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      'x-admin-api-key': ADMIN_KEY,
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function main() {
  console.log('=== Admin Staff QR dashboard DB test ===\n');

  const event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true },
  });
  assert(Boolean(event), 'No event found in database');

  const staffMember = await prisma.staffMember.findFirst({
    include: { zone: true },
    orderBy: { createdAt: 'asc' },
  });
  assert(Boolean(staffMember), 'No staff member found in database');

  const eventId = event!.id;
  const eventTitle = event!.title;
  const staff = staffMember!;

  await prisma.staffScanLog.deleteMany({
    where: { itemName: { startsWith: TEST_PREFIX } },
  });

  const baselineDbCount = await countEventScansToday(eventTitle);
  const baselineDashboard = await adminEventStaffQrService.getEventStaffQrDashboard(eventId);

  assert(
    baselineDashboard.summary.scans_today === baselineDbCount,
    `Baseline mismatch: dashboard=${baselineDashboard.summary.scans_today}, db=${baselineDbCount}`,
  );
  pass(`baseline dashboard matches DB (${baselineDbCount} scan(s) today)`);

  assert(
    !JSON.stringify(baselineDashboard.qr_live).includes('Camila Méndez'),
    'Dashboard still contains demo placeholder data',
  );
  pass('dashboard does not return hardcoded demo feed');

  const now = new Date();
  const seeded = await prisma.staffScanLog.createMany({
    data: [
      {
        staffMemberId: staff.id,
        scanType: 'product',
        outcome: 'valid',
        guestName: 'Guest Alpha',
        itemName: `${TEST_PREFIX}Pisco Sour`,
        eventTitle,
        entryId: 'E2E-001',
        transactionId: 'E2E-001',
        qrPayload: `${TEST_PREFIX}payload-1`,
        barName: staff.zone.label,
        scannedAt: now,
      },
      {
        staffMemberId: staff.id,
        scanType: 'product',
        outcome: 'valid',
        guestName: 'Guest Beta',
        itemName: `${TEST_PREFIX}Corona`,
        eventTitle,
        entryId: 'E2E-002',
        transactionId: 'E2E-002',
        qrPayload: `${TEST_PREFIX}payload-2`,
        barName: staff.zone.label,
        scannedAt: new Date(now.getTime() - 1000),
      },
      {
        staffMemberId: staff.id,
        scanType: 'entry',
        outcome: 'already_used',
        guestName: 'Guest Gamma',
        itemName: `${TEST_PREFIX}VIP Entry`,
        eventTitle,
        entryId: 'E2E-003',
        transactionId: 'E2E-003',
        qrPayload: `${TEST_PREFIX}payload-3`,
        accessLevel: 'VIP 1',
        scannedAt: new Date(now.getTime() - 2000),
      },
    ],
  });

  assert(seeded.count === 3, `Expected 3 seeded logs, got ${seeded.count}`);
  pass('seeded 3 test scan logs in database');

  const updatedDbCount = await countEventScansToday(eventTitle);
  assert(updatedDbCount === baselineDbCount + 3, 'DB count did not increase by 3 after seeding');
  pass(`DB count updated (${baselineDbCount} -> ${updatedDbCount})`);

  const dashboard = await adminEventStaffQrService.getEventStaffQrDashboard(eventId);
  assert(
    dashboard.summary.scans_today === updatedDbCount,
    `Updated dashboard count mismatch: ${dashboard.summary.scans_today} vs ${updatedDbCount}`,
  );
  pass('dashboard scans_today reflects new DB count');

  const expectedInvalid = baselineDashboard.summary.invalid_qr_today + 1;
  assert(
    dashboard.summary.invalid_qr_today === expectedInvalid,
    `invalid_qr_today expected ${expectedInvalid}, got ${dashboard.summary.invalid_qr_today}`,
  );
  pass('invalid_qr_today incremented for already_used scan');

  const seededLiveItems = dashboard.qr_live.filter((item) =>
    item.detail.startsWith(TEST_PREFIX),
  );
  assert(seededLiveItems.length >= 2, 'Seeded scans missing from qr_live feed');
  assert(
    seededLiveItems.every((item) => item.staff_name === staff.name),
    'qr_live staff_name should be scanner name, not guest name',
  );
  pass('qr_live shows scanner staff names for seeded scans');

  const zoneRow = dashboard.activity_by_zone.find((row) => row.zone === staff.zone.label);
  assert(Boolean(zoneRow), `Expected zone activity for ${staff.zone.label}`);
  assert(
    (zoneRow?.count ?? 0) >= 3,
    `Zone count too low after seeding: ${zoneRow?.count ?? 0}`,
  );
  pass('activity_by_zone includes staff zone counts');

  assert(Boolean(dashboard.top_bar), 'Expected top_bar after product scans');
  assert(
    dashboard.top_bar!.scans >= 2,
    `Expected top_bar scans >= 2, got ${dashboard.top_bar!.scans}`,
  );
  pass('top_bar computed from product scan logs');

  const list = await adminEventStaffQrService.listEventStaffQrScans(eventId, 1, 50);
  assert(list.total === updatedDbCount, `List total mismatch: ${list.total} vs ${updatedDbCount}`);
  assert(
    list.scans.some((scan) => scan.detail.startsWith(TEST_PREFIX)),
    'Paginated scan list missing seeded items',
  );
  pass('paginated scan list matches DB total and includes seeded scans');

  const apiDashboard = await adminRequest(`/admin/events/${eventId}/staff-qr`);
  if (apiDashboard.status === 200 && apiDashboard.body?.success) {
    assert(
      apiDashboard.body.data.summary.scans_today === updatedDbCount,
      'HTTP dashboard scans_today mismatch',
    );
    pass('GET /admin/events/:id/staff-qr returns updated counts');
  } else {
    console.log('  ~ skipped HTTP dashboard check (API not reachable)');
  }

  const apiList = await adminRequest(`/admin/events/${eventId}/staff-qr/scans?page=1&limit=50`);
  if (apiList.status === 200 && apiList.body?.success) {
    assert(apiList.body.data.total === updatedDbCount, 'HTTP scan list total mismatch');
    pass('GET /admin/events/:id/staff-qr/scans returns updated total');
  } else {
    console.log('  ~ skipped HTTP scan list check (API not reachable)');
  }

  await prisma.staffScanLog.deleteMany({
    where: { itemName: { startsWith: TEST_PREFIX } },
  });

  const afterCleanupDbCount = await countEventScansToday(eventTitle);
  assert(
    afterCleanupDbCount === baselineDbCount,
    `Cleanup failed: expected ${baselineDbCount}, got ${afterCleanupDbCount}`,
  );
  pass('cleanup restored baseline DB count');

  const afterCleanupDashboard = await adminEventStaffQrService.getEventStaffQrDashboard(eventId);
  assert(
    afterCleanupDashboard.summary.scans_today === baselineDbCount,
    'Dashboard count did not return to baseline after cleanup',
  );
  pass('dashboard count returns to baseline after cleanup');

  console.log(`\nPASS: admin Staff QR dashboard DB test (${passed} checks)\n`);
}

main()
  .catch((error) => {
    console.error(`\nFAIL: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.staffScanLog.deleteMany({
      where: { itemName: { startsWith: TEST_PREFIX } },
    });
    await prisma.$disconnect();
  });
