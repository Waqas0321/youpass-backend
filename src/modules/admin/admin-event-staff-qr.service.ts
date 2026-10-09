import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { adminStaffService } from './admin-staff.service.js';

const DEFAULT_TIMEZONE = 'America/Santiago';
const QR_SCAN_OUTCOMES = ['valid', 'already_used'] as const;
/** Nightlife "day": scans until 06:00 local still belong to the previous night. */
const OPERATING_DAY_START_HOUR = 6;

/** Offset (ms) of `timeZone` from UTC at `date`: wall-clock time minus real time. */
function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Current operating day [06:00 local, next 06:00 local) as UTC instants. */
function todayWindow(timeZone: string, now = new Date()) {
  const shifted = new Date(now.getTime() - OPERATING_DAY_START_HOUR * 3600_000);
  const wall = new Date(shifted.getTime() + timezoneOffsetMs(shifted, timeZone));
  const wallStart = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate(),
    OPERATING_DAY_START_HOUR,
  );
  const gte = new Date(wallStart - timezoneOffsetMs(new Date(wallStart), timeZone));
  return { gte, lte: new Date(gte.getTime() + 24 * 3600_000 - 1) };
}

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, countryCode: true },
  });

  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  const country = await prisma.country.findFirst({
    where: { code: event.countryCode },
    select: { timezone: true },
  });
  return { ...event, timeZone: country?.timezone || DEFAULT_TIMEZONE };
}

type ScanLogWithStaff = Awaited<ReturnType<typeof loadEventScanLogs>>[number];

function resolveScanZone(log: ScanLogWithStaff) {
  if (log.scanType === 'product') {
    return log.barName ?? log.staffMember.zone.label;
  }

  return log.accessLevel ?? log.staffMember.zone.label;
}

/** Supervisor actions are logged with machine codes; show them readably in the live feed. */
function formatScanDetail(itemName: string) {
  if (!itemName.startsWith('supervisor_')) {
    return itemName;
  }
  const words = itemName
    .replace(/^supervisor_(entry_|drink_)?/, '')
    .replace(/_/g, ' ')
    .trim();
  return `Supervisor · ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function formatQrLiveItem(log: ScanLogWithStaff, timeZone: string) {
  return {
    id: log.id,
    time_label: formatTime(log.scannedAt.toISOString(), timeZone),
    staff_name: log.staffMember.name,
    guest_name: log.guestName,
    detail: formatScanDetail(log.itemName),
    zone: resolveScanZone(log),
    kind: log.scanType === 'product' ? ('drink' as const) : ('ticket' as const),
    outcome: log.outcome,
    occurred_at: log.scannedAt.toISOString(),
  };
}

function eventScanLogWhere(eventTitle: string, window: { gte: Date; lte: Date }) {
  return {
    eventTitle,
    scannedAt: { gte: window.gte, lte: window.lte },
    outcome: { in: [...QR_SCAN_OUTCOMES] },
  };
}

async function loadEventScanLogs(eventTitle: string, window: { gte: Date; lte: Date }, take?: number) {
  return prisma.staffScanLog.findMany({
    where: eventScanLogWhere(eventTitle, window),
    include: {
      staffMember: {
        include: { zone: true },
      },
    },
    orderBy: { scannedAt: 'desc' },
    ...(take ? { take } : {}),
  });
}

function buildActivityByZone(logs: ScanLogWithStaff[]) {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const zone = log.staffMember.zone.label;
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count);
}

function buildTopBar(logs: ScanLogWithStaff[]) {
  const productLogs = logs.filter((log) => log.scanType === 'product' && log.outcome === 'valid');
  if (productLogs.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const log of productLogs) {
    const barName = log.barName ?? log.staffMember.zone.label;
    counts.set(barName, (counts.get(barName) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [name, scans] = sorted[0];
  const total = productLogs.length;

  return {
    name,
    scans,
    share_pct: total > 0 ? Math.round((scans / total) * 100) : 0,
  };
}

function buildSummaryMetrics(logs: ScanLogWithStaff[]) {
  const scansToday = logs.length;
  const validScans = logs.filter((log) => log.outcome === 'valid').length;
  const invalidScans = logs.filter((log) => log.outcome === 'already_used').length;
  const qrEfficiencyPct =
    scansToday > 0 ? Math.round((validScans / scansToday) * 1000) / 10 : 0;
  const invalidSharePct =
    scansToday > 0 ? Math.round((invalidScans / scansToday) * 1000) / 10 : 0;

  return {
    scans_today: scansToday,
    qr_efficiency_pct: qrEfficiencyPct,
    invalid_qr_today: invalidScans,
    invalid_qr_share_pct: invalidSharePct,
  };
}

export const adminEventStaffQrService = {
  async getEventStaffQrDashboard(eventId: string) {
    const event = await assertEventExists(eventId);
    const window = todayWindow(event.timeZone);
    const fetchedAt = new Date().toISOString();

    const [roles, staff, permissions, todayLogs] = await Promise.all([
      adminStaffService.listRoles(),
      adminStaffService.listMembers(),
      Promise.resolve(adminStaffService.getPermissionCatalog()),
      loadEventScanLogs(event.title, window),
    ]);

    const scanMetrics = buildSummaryMetrics(todayLogs);
    // `status` is only the admin on/pause switch; online means seen in the last 15 minutes.
    const onlineSince = Date.now() - 15 * 60 * 1000;
    const activeStaff = staff.filter(
      (member) =>
        member.status === 'online' && new Date(member.last_activity_at).getTime() >= onlineSince,
    ).length;
    const zonesAssigned = new Set(staff.map((member) => member.zone)).size;

    return {
      event_id: eventId,
      event_title: event.title,
      fetched_at: fetchedAt,
      roles,
      permissions,
      summary: {
        active_staff: activeStaff,
        zones_assigned: zonesAssigned,
        ...scanMetrics,
      },
      staff,
      staff_total: staff.length,
      qr_live: todayLogs.slice(0, 8).map((log) => formatQrLiveItem(log, event.timeZone)),
      top_bar: buildTopBar(todayLogs),
      activity_by_zone: buildActivityByZone(todayLogs),
    };
  },

  async listEventStaffQrScans(eventId: string, page = 1, limit = 20) {
    const event = await assertEventExists(eventId);
    const window = todayWindow(event.timeZone);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const where = eventScanLogWhere(event.title, window);

    const [total, rows] = await Promise.all([
      prisma.staffScanLog.count({ where }),
      prisma.staffScanLog.findMany({
        where,
        include: {
          staffMember: {
            include: { zone: true },
          },
        },
        orderBy: { scannedAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);

    return {
      event_id: eventId,
      page: safePage,
      limit: safeLimit,
      total,
      scans: rows.map((log) => formatQrLiveItem(log, event.timeZone)),
    };
  },
};
