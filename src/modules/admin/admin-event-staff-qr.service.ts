import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { adminStaffService } from './admin-staff.service.js';

const DASHBOARD_TIMEZONE = 'America/Santiago';
const QR_SCAN_OUTCOMES = ['valid', 'already_used'] as const;

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

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DASHBOARD_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  return event;
}

type ScanLogWithStaff = Awaited<ReturnType<typeof loadEventScanLogs>>[number];

function resolveScanZone(log: ScanLogWithStaff) {
  if (log.scanType === 'product') {
    return log.barName ?? log.staffMember.zone.label;
  }

  return log.accessLevel ?? log.staffMember.zone.label;
}

function formatQrLiveItem(log: ScanLogWithStaff) {
  return {
    id: log.id,
    time_label: formatTime(log.scannedAt.toISOString()),
    staff_name: log.staffMember.name,
    detail: log.itemName,
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
    const window = todayWindow();
    const fetchedAt = new Date().toISOString();

    const [roles, staff, permissions, todayLogs] = await Promise.all([
      adminStaffService.listRoles(),
      adminStaffService.listMembers(),
      Promise.resolve(adminStaffService.getPermissionCatalog()),
      loadEventScanLogs(event.title, window),
    ]);

    const scanMetrics = buildSummaryMetrics(todayLogs);
    const activeStaff = staff.filter((member) => member.status === 'online').length;
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
      qr_live: todayLogs.slice(0, 8).map(formatQrLiveItem),
      top_bar: buildTopBar(todayLogs),
      activity_by_zone: buildActivityByZone(todayLogs),
    };
  },

  async listEventStaffQrScans(eventId: string, page = 1, limit = 20) {
    const event = await assertEventExists(eventId);
    const window = todayWindow();
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
      scans: rows.map(formatQrLiveItem),
    };
  },
};
