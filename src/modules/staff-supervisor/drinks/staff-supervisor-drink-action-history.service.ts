import { prisma } from '../../../config/database.js';
import { AppError } from '../../../common/errors/app-error.js';
import { formatTimeLabel } from '../staff-supervisor-entry-search.service.js';
import { DRINK_SUPERVISOR_ACTION_PREFIX } from './staff-supervisor-drink-audit.constants.js';

type BarActionHistoryQuery = {
  event_id?: string;
  limit?: number;
};

function activeEventWindow() {
  const now = Date.now();
  return {
    startsAt: {
      gte: new Date(now - 24 * 60 * 60 * 1000),
      lte: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
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

  const events = await prisma.event.findMany({
    where: activeEventWindow(),
    select: { id: true, title: true, countryCode: true, startsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 20,
  });

  if (events.length === 0) {
    throw new AppError(404, 'ACTIVE_EVENT_NOT_FOUND', 'No active event found for action history');
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const drinkCounts = await Promise.all(
    events.map(async (event) => {
      const count = await prisma.eventDrinkRedemption.count({
        where: {
          order: { eventId: event.id },
          createdAt: { gte: since },
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

function parseDrinkAction(itemName: string) {
  const withoutPrefix = itemName.slice(DRINK_SUPERVISOR_ACTION_PREFIX.length);
  const separatorIndex = withoutPrefix.indexOf('_');
  if (separatorIndex <= 0) {
    return { scope: 'override', kind: withoutPrefix };
  }

  return {
    scope: withoutPrefix.slice(0, separatorIndex),
    kind: withoutPrefix.slice(separatorIndex + 1),
  };
}

function mapDashboardType(kind: string) {
  if (kind.includes('cancel') || kind === 'reject_consumption') {
    return 'consumption_cancelled' as const;
  }

  if (
    kind.includes('manual') ||
    kind === 'authorize_consumption' ||
    kind === 'generate_temporary_qr'
  ) {
    return 'manual_validation' as const;
  }

  if (kind.includes('release') || kind === 'temporary_unlock' || kind === 'authorize_reconsumption') {
    return 'qr_released' as const;
  }

  return 'manual_validation' as const;
}

export const staffSupervisorDrinkActionHistoryService = {
  async getActionHistory(query: BarActionHistoryQuery) {
    const event = await resolveEvent(query.event_id);
    const limit = query.limit ?? 50;

    const entryIds = (
      await prisma.eventDrinkRedemption.findMany({
        where: { order: { eventId: event.id } },
        select: { manualEntryId: true },
      })
    ).map((row) => row.manualEntryId);

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
        entryId: { in: entryIds },
        itemName: { startsWith: DRINK_SUPERVISOR_ACTION_PREFIX },
        outcome: 'supervisor_resolved',
      },
      orderBy: { scannedAt: 'desc' },
      take: limit,
      include: {
        staffMember: { select: { id: true, name: true } },
      },
    });

    const redemptionByEntryId = new Map(
      (
        await prisma.eventDrinkRedemption.findMany({
          where: { manualEntryId: { in: logs.map((log) => log.entryId!).filter(Boolean) } },
          select: { id: true, manualEntryId: true, orderId: true },
        })
      ).map((row) => [row.manualEntryId, row]),
    );

    const actions = logs.map((log) => {
      const parsed = parseDrinkAction(log.itemName);
      const redemption = log.entryId ? redemptionByEntryId.get(log.entryId) : null;

      return {
        id: log.id,
        scope: parsed.scope,
        kind: parsed.kind,
        dashboard_type: mapDashboardType(parsed.kind),
        supervisor_name: log.staffMember.name,
        guest_name: log.guestName,
        time_label: formatTimeLabel(log.scannedAt, event.countryCode),
        occurred_at: log.scannedAt.toISOString(),
        redemption_id: redemption?.id ?? null,
        order_id: redemption?.orderId ?? log.transactionId,
        entry_id: log.entryId,
        product_name: log.itemName.includes('consumption') ? null : log.itemName,
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
