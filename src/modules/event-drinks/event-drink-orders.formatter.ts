import type {
  Event,
  EventDrinkOrder,
  EventDrinkOrderLine,
  EventDrinkRedemption,
} from '@prisma/client';
import { resolveQrStatus } from '../invitations/invitations.utils.js';

type LineWithRedemption = EventDrinkOrderLine & {
  redemption: EventDrinkRedemption | null;
};

type OrderWithRelations = EventDrinkOrder & {
  event: Pick<Event, 'id' | 'title' | 'startsAt'>;
  lines: LineWithRedemption[];
  redemptions: EventDrinkRedemption[];
};

function resolveLineRedemption(
  line: LineWithRedemption,
  order: OrderWithRelations,
): EventDrinkRedemption | null {
  const redemptions = order.redemptions ?? [];

  if (line.redemption) {
    return line.redemption;
  }

  const linked = redemptions.find((redemption) => redemption.lineId === line.id);
  if (linked) {
    return linked;
  }

  const legacyOrphans = redemptions.filter((redemption) => redemption.lineId == null);
  if (legacyOrphans.length === 1) {
    return legacyOrphans[0] ?? null;
  }

  // Legacy orders stored a single redemption on the order before per-line QRs.
  if (redemptions.length === 1) {
    return redemptions[0] ?? null;
  }

  return null;
}

function formatLineRedemption(
  line: LineWithRedemption,
  order: OrderWithRelations,
): {
  entry_code: string | null;
  qr_payload: string | null;
  qr_status: ReturnType<typeof resolveQrStatus>;
  redeemed_at: string | null;
} {
  const redemption = resolveLineRedemption(line, order);
  if (!redemption) {
    return {
      entry_code: null,
      qr_payload: null,
      qr_status: 'locked' as const,
      redeemed_at: null,
    };
  }

  const qrStatus = resolveQrStatus(
    redemption.unlockAt,
    redemption.validatedAt,
    order.event.startsAt,
  );

  return {
    entry_code: redemption.manualEntryId,
    qr_payload: qrStatus === 'expired' ? null : redemption.qrPayload,
    qr_status: qrStatus,
    redeemed_at: redemption.validatedAt?.toISOString() ?? null,
  };
}

function formatLineItem(line: LineWithRedemption, order: OrderWithRelations) {
  const redemption = formatLineRedemption(line, order);

  return {
    line_id: line.id,
    product_id: line.productId,
    product_name: line.productName,
    quantity: line.quantity,
    unit_price_clp: line.unitPriceClp,
    line_total_clp: line.lineTotalClp,
    volume_ml: line.volumeMl,
    image_url: line.imageUrl,
    entry_code: redemption.entry_code,
    qr_payload: redemption.qr_payload,
    qr_status: redemption.qr_status,
    redeemed_at: redemption.redeemed_at,
  };
}

function deriveOrderQrStatus(lines: LineWithRedemption[], order: OrderWithRelations) {
  if (lines.length === 0) {
    return 'locked' as const;
  }

  const statuses = lines.map((line) => formatLineRedemption(line, order).qr_status);

  if (statuses.every((status) => status === 'redeemed')) {
    return 'redeemed' as const;
  }
  if (statuses.some((status) => status === 'available')) {
    return 'available' as const;
  }
  if (statuses.some((status) => status === 'locked')) {
    return 'locked' as const;
  }
  if (statuses.some((status) => status === 'expired')) {
    return 'expired' as const;
  }

  return statuses[0] ?? ('locked' as const);
}

export function formatDrinkOrder(order: OrderWithRelations) {
  const lineItems = order.lines.map((line) => formatLineItem(line, order));
  const orderQrStatus = deriveOrderQrStatus(order.lines, order);
  const redeemedAt = order.lines
    .map((line) => resolveLineRedemption(line, order)?.validatedAt)
    .filter((value): value is Date => value != null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    order_id: order.id,
    display_order_id: formatDisplayOrderId(order.id),
    event_id: order.eventId,
    event_title: order.event.title,
    subtotal_clp: order.subtotalClp,
    service_fee_clp: order.serviceFeeClp,
    total_clp: order.totalClp,
    currency: order.currency,
    item_count: order.itemCount,
    status: order.status,
    is_complimentary: order.isComplimentary,
    qr_status: orderQrStatus,
    redeemed_at: redeemedAt?.toISOString() ?? null,
    line_items: lineItems,
    created_at: order.createdAt.toISOString(),
  };
}

function formatDisplayOrderId(orderId: string) {
  const suffix = orderId.slice(-5).toUpperCase();
  return `#${suffix}`;
}
