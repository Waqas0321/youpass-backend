import type {
  Event,
  EventDrinkOrder,
  EventDrinkOrderLine,
  EventDrinkRedemption,
  User,
} from '@prisma/client';
import { resolveQrStatus } from '../invitations/invitations.utils.js';

export type AdminDrinkOrderQrStatus =
  | 'paid'
  | 'pending'
  | 'redeemed'
  | 'refunded'
  | 'invalid';

type LineWithRedemption = EventDrinkOrderLine & {
  redemption: EventDrinkRedemption | null;
};

type AdminOrderWithRelations = EventDrinkOrder & {
  event: Pick<Event, 'id' | 'title' | 'startsAt'>;
  user: Pick<User, 'id' | 'fullName' | 'phone' | 'profilePhotoUrl'>;
  lines: LineWithRedemption[];
  redemptions: EventDrinkRedemption[];
};

function resolveLineRedemption(
  line: LineWithRedemption,
  order: AdminOrderWithRelations,
): EventDrinkRedemption | null {
  if (line.redemption) {
    return line.redemption;
  }

  const linked = order.redemptions.find((redemption) => redemption.lineId === line.id);
  if (linked) {
    return linked;
  }

  const legacyOrphans = order.redemptions.filter((redemption) => redemption.lineId == null);
  if (legacyOrphans.length === 1) {
    return legacyOrphans[0] ?? null;
  }

  if (order.redemptions.length === 1) {
    return order.redemptions[0] ?? null;
  }

  return null;
}

function resolveLineQrStatus(
  line: LineWithRedemption,
  order: AdminOrderWithRelations,
): AdminDrinkOrderQrStatus {
  if (order.status === 'refunded') {
    return 'refunded';
  }
  if (order.status === 'cancelled' || order.status === 'expired') {
    return 'invalid';
  }

  const redemption = resolveLineRedemption(line, order);
  if (!redemption) {
    return 'invalid';
  }

  if (redemption.validatedAt) {
    return 'redeemed';
  }

  const qrStatus = resolveQrStatus(
    redemption.unlockAt,
    redemption.validatedAt,
    order.event.startsAt,
  );

  if (qrStatus === 'locked') {
    return 'pending';
  }
  if (qrStatus === 'expired') {
    return 'invalid';
  }
  if (qrStatus === 'redeemed') {
    return 'redeemed';
  }

  return 'paid';
}

export function resolveAdminDrinkOrderQrStatus(
  order: AdminOrderWithRelations,
): AdminDrinkOrderQrStatus {
  if (order.status === 'refunded') {
    return 'refunded';
  }
  if (order.status === 'cancelled' || order.status === 'expired') {
    return 'invalid';
  }
  if (order.lines.length === 0) {
    return 'invalid';
  }

  const lineStatuses = order.lines.map((line) => resolveLineQrStatus(line, order));

  if (lineStatuses.every((status) => status === 'redeemed')) {
    return 'redeemed';
  }
  if (lineStatuses.some((status) => status === 'pending')) {
    return 'pending';
  }
  if (lineStatuses.some((status) => status === 'paid')) {
    return 'paid';
  }
  if (lineStatuses.some((status) => status === 'invalid')) {
    return 'invalid';
  }

  return lineStatuses[0] ?? 'invalid';
}

export function formatAdminDisplayOrderId(orderId: string) {
  const suffix = orderId.slice(-7).toUpperCase();
  return `#ORD-${suffix}`;
}

function formatProductSummary(lines: EventDrinkOrderLine[]) {
  if (lines.length === 0) {
    return '—';
  }
  if (lines.length === 1) {
    const line = lines[0]!;
    return line.quantity > 1 ? `${line.productName} x${line.quantity}` : line.productName;
  }
  return lines.map((line) => line.productName).join(', ');
}

function formatUserInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function pickPrimaryEntryCode(order: AdminOrderWithRelations) {
  const redeemableLine = order.lines.find((line) => {
    const status = resolveLineQrStatus(line, order);
    return status === 'paid' || status === 'pending';
  });

  if (redeemableLine) {
    const redemption = resolveLineRedemption(redeemableLine, order);
    if (redemption?.manualEntryId) {
      return redemption.manualEntryId;
    }
  }

  for (const line of order.lines) {
    const redemption = resolveLineRedemption(line, order);
    if (redemption?.manualEntryId) {
      return redemption.manualEntryId;
    }
  }

  return null;
}

export function formatAdminDrinkOrderListItem(order: AdminOrderWithRelations) {
  const qrStatus = resolveAdminDrinkOrderQrStatus(order);

  return {
    order_id: order.id,
    display_order_id: formatAdminDisplayOrderId(order.id),
    user: {
      id: order.user.id,
      full_name: order.user.fullName,
      phone: order.user.phone,
      profile_photo_url: order.user.profilePhotoUrl,
      initials: formatUserInitials(order.user.fullName),
    },
    product_summary: formatProductSummary(order.lines),
    payment_method: {
      type: 'none',
      label: 'Sin pago',
      brand: 'app',
      last_four: null,
    },
    created_at: order.createdAt.toISOString(),
    qr_status: qrStatus,
    total_clp: order.totalClp,
    currency: order.currency,
    entry_code: pickPrimaryEntryCode(order),
    status: order.status,
    line_items: order.lines.map((line) => {
      const lineQrStatus = resolveLineQrStatus(line, order);
      const redemption = resolveLineRedemption(line, order);

      return {
        line_id: line.id,
        product_id: line.productId,
        product_name: line.productName,
        quantity: line.quantity,
        unit_price_clp: line.unitPriceClp,
        line_total_clp: line.lineTotalClp,
        volume_ml: line.volumeMl,
        image_url: line.imageUrl,
        entry_code: redemption?.manualEntryId ?? null,
        qr_status: lineQrStatus,
        qr_payload:
          redemption &&
          (lineQrStatus === 'paid' || lineQrStatus === 'redeemed')
            ? redemption.qrPayload
            : null,
      };
    }),
  };
}

export function formatAdminDrinkOrderDetail(order: AdminOrderWithRelations) {
  const listItem = formatAdminDrinkOrderListItem(order);

  return {
    ...listItem,
    event_id: order.eventId,
    event_title: order.event.title,
    subtotal_clp: order.subtotalClp,
    service_fee_clp: order.serviceFeeClp,
    item_count: order.itemCount,
  };
}

export const ADMIN_QR_STATUS_LABELS: Record<
  AdminDrinkOrderQrStatus,
  { label: string; tone: 'success' | 'warning' | 'info' | 'purple' | 'danger' }
> = {
  paid: { label: 'PAGADO', tone: 'success' },
  pending: { label: 'PENDIENTE', tone: 'warning' },
  redeemed: { label: 'CANJEADO', tone: 'info' },
  refunded: { label: 'REEMBOLSADO', tone: 'purple' },
  invalid: { label: 'INVÁLIDO', tone: 'danger' },
};
