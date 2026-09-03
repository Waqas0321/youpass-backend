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
    throw new AppError(404, 'ACTIVE_EVENT_NOT_FOUND', 'No active event found for redemption history');
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
