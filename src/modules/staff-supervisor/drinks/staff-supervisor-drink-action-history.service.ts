import { prisma } from '../../../config/database.js';
import { AppError } from '../../../common/errors/app-error.js';
import { formatTimeLabel } from '../staff-supervisor-entry-search.service.js';
import { DRINK_SUPERVISOR_ACTION_PREFIX } from './staff-supervisor-drink-audit.constants.js';

type BarActionHistoryQuery = {
  event_id?: string;
  limit?: number;
};

function candidateEventWindow() {
  const now = Date.now();
  return {
    startsAt: {
      // Keep QA / multi-month calendars in range (was -1d / +30d and missed real scans).
      gte: new Date(now - 90 * 24 * 60 * 60 * 1000),
      lte: new Date(now + 180 * 24 * 60 * 60 * 1000),
    },
  };
}

async function resolveEventFromRecentProductScans(since: Date) {
  const recentLogs = await prisma.staffScanLog.findMany({
    where: {
      scanType: 'product',
      scannedAt: { gte: since },
      entryId: { not: null },
    },
    select: { entryId: true, scannedAt: true },
    orderBy: { scannedAt: 'desc' },
    take: 400,
  });

  if (recentLogs.length === 0) {
    return null;
  }

  const entryIds = [
    ...new Set(
      recentLogs
        .map((log) => log.entryId)
        .filter((entryId): entryId is string => Boolean(entryId)),
    ),
  ];

  const redemptions = await prisma.eventDrinkRedemption.findMany({
    where: { manualEntryId: { in: entryIds } },
    select: {
      manualEntryId: true,
      order: {
        select: {
          event: {
            select: { id: true, title: true, countryCode: true, startsAt: true },
          },
        },
      },
    },
  });

  const eventByEntryId = new Map(
    redemptions.map((row) => [row.manualEntryId, row.order.event]),
  );
  const score = new Map<
    string,
    {
      event: { id: string; title: string; countryCode: string; startsAt: Date };
      count: number;
      latest: number;
    }
  >();

  for (const log of recentLogs) {
    if (!log.entryId) {
      continue;
    }
    const event = eventByEntryId.get(log.entryId);
    if (!event) {
      continue;
    }
    const current = score.get(event.id);
    if (current) {
      current.count += 1;
      current.latest = Math.max(current.latest, log.scannedAt.getTime());
    } else {
      score.set(event.id, {
        event,
        count: 1,
        latest: log.scannedAt.getTime(),
      });
    }
  }

  const ranked = [...score.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return right.latest - left.latest;
  });

  const selected = ranked[0]?.event;
  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    title: selected.title,
    countryCode: selected.countryCode,
  };
}

async function resolveEvent(eventId?: string) {
  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, countryCode: true },
    });

    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    return event;
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const fromRecentScans = await resolveEventFromRecentProductScans(since);
  if (fromRecentScans) {
    return fromRecentScans;
  }

  const events = await prisma.event.findMany({
    where: candidateEventWindow(),
    select: { id: true, title: true, countryCode: true, startsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 40,
  });

  if (events.length === 0) {
    throw new AppError(404, 'ACTIVE_EVENT_NOT_FOUND', 'No active event found for redemption history');
  }

  const drinkCounts = await Promise.all(
    events.map(async (event) => {
      const entryIds = (
        await prisma.eventDrinkRedemption.findMany({
          where: { order: { eventId: event.id } },
          select: { manualEntryId: true },
          take: 500,
        })
      ).map((row) => row.manualEntryId);

      const count =
        entryIds.length === 0
          ? 0
          : await prisma.staffScanLog.count({
              where: {
                scanType: 'product',
                entryId: { in: entryIds },
                scannedAt: { gte: since },
              },
            });
      return { event, count };
    }),
  );

  drinkCounts.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const now = Date.now();
    return (
      Math.abs(left.event.startsAt.getTime() - now) -
      Math.abs(right.event.startsAt.getTime() - now)
    );
  });

  const selected = drinkCounts[0]?.event ?? events[0];
  return {
    id: selected.id,
    title: selected.title,
    countryCode: selected.countryCode,
  };
}

function classifyRedemptionLog(outcome: string, itemName: string) {
  const isSupervisor = itemName.startsWith(DRINK_SUPERVISOR_ACTION_PREFIX);
  const normalized = itemName.toLowerCase();

  if (
    isSupervisor &&
    (normalized.includes('revert_validation') ||
      normalized.includes('authorize_reconsumption') ||
      normalized.includes('restore'))
  ) {
    return {
      result: 'RESTORED' as const,
      kind: 'restore_consumption',
      scope: 'cancellation',
      dashboard_type: 'qr_released' as const,
    };
  }

  if (isSupervisor) {
    return {
      result: 'SUPERVISOR' as const,
      kind: normalized.includes('cancel') ? 'cancel_consumption' : 'supervisor_action',
      scope: 'override',
      dashboard_type: 'consumption_cancelled' as const,
    };
  }

  if (outcome === 'already_used') {
    return {
      result: 'DUPLICATE_ATTEMPT' as const,
      kind: 'duplicate_attempt',
      scope: 'scan',
      dashboard_type: 'manual_validation' as const,
    };
  }

  return {
    result: 'REDEEMED' as const,
    kind: 'redeemed',
    scope: 'scan',
    dashboard_type: 'manual_validation' as const,
  };
}

export const staffSupervisorDrinkActionHistoryService = {
  /**
   * Event-wide Redemption History: product scans + restores.
   * Spec: REDEEMED / RESTORED / DUPLICATE ATTEMPT with product, customer, bar, staff.
   */
  async getActionHistory(query: BarActionHistoryQuery) {
    const event = await resolveEvent(query.event_id);
    const limit = query.limit ?? 50;

    const redemptions = await prisma.eventDrinkRedemption.findMany({
      where: { order: { eventId: event.id } },
      select: {
        id: true,
        manualEntryId: true,
        orderId: true,
        validatedAt: true,
        order: {
          select: {
            user: { select: { fullName: true, phone: true } },
            lines: { select: { productName: true, quantity: true }, take: 1 },
          },
        },
      },
    });

    const entryIds = redemptions.map((row) => row.manualEntryId);
    const redemptionByEntryId = new Map(redemptions.map((row) => [row.manualEntryId, row]));

    if (entryIds.length === 0) {
      return {
        event_id: event.id,
        event_title: event.title,
        actions: [],
        total: 0,
      };
    }

    const logs = await prisma.staffScanLog.findMany({
      where: {
        scanType: 'product',
        entryId: { in: entryIds },
      },
      orderBy: { scannedAt: 'desc' },
      take: limit,
      include: {
        staffMember: { select: { id: true, name: true } },
      },
    });

    const actions = logs.map((log) => {
      const redemption = log.entryId ? redemptionByEntryId.get(log.entryId) : null;
      const classified = classifyRedemptionLog(log.outcome, log.itemName);
      const productName =
        !log.itemName.startsWith(DRINK_SUPERVISOR_ACTION_PREFIX)
          ? log.itemName
          : redemption?.order.lines[0]?.productName ?? null;
      const guestName =
        log.guestName?.trim() || redemption?.order.user.fullName?.trim() || null;

      return {
        id: log.id,
        scope: classified.scope,
        kind: classified.kind,
        result: classified.result,
        dashboard_type: classified.dashboard_type,
        supervisor_name: log.staffMember.name,
        staff_name: log.staffMember.name,
        guest_name: guestName,
        product_name: productName,
        product_quantity: log.productQuantity ?? redemption?.order.lines[0]?.quantity ?? null,
        bar_name: log.barName,
        time_label: formatTimeLabel(log.scannedAt, event.countryCode),
        occurred_at: log.scannedAt.toISOString(),
        redemption_id: redemption?.id ?? null,
        order_id: redemption?.orderId ?? log.transactionId,
        entry_id: log.entryId,
        manual_code: log.entryId,
        current_status: redemption?.validatedAt ? 'redeemed' : 'restored_or_pending',
      };
    });

    return {
      event_id: event.id,
      event_title: event.title,
      actions,
      total: actions.length,
    };
  },
};
