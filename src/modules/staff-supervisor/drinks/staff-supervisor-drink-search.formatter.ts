import { prisma } from '../../../config/database.js';
import { formatTimeLabel } from '../staff-supervisor-entry-search.service.js';
import {
  formatDrinkOrderCode,
  loadDrinkRedemptionById,
  resolveDrinkStatus,
  resolveRedemptionLine,
  searchSupervisorDrinks,
  type DrinkRedemptionWithContext,
} from './staff-supervisor-drink-search.service.js';

function formatGuestPhone(user: DrinkRedemptionWithContext['order']['user']) {
  return user.phone?.trim() || null;
}

function formatLastIdDigits(redemption: DrinkRedemptionWithContext) {
  const manualSuffix = redemption.manualEntryId.replace(/\D/g, '').slice(-4);
  if (manualSuffix.length >= 4) {
    return manualSuffix;
  }

  const documentSuffix = redemption.order.user.rutOrPassport.replace(/\D/g, '').slice(-4);
  return documentSuffix.length >= 4 ? documentSuffix : manualSuffix || '0000';
}

function formatValidatorDetail(staffMember: {
  name: string;
  zone: { label: string; slug: string };
}) {
  const zoneCode = staffMember.zone.label
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '');

  if (zoneCode.length >= 3) {
    return zoneCode;
  }

  return staffMember.name;
}

async function resolveBarContext(manualEntryId: string) {
  const latestScan = await prisma.staffScanLog.findFirst({
    where: {
      entryId: manualEntryId,
      scanType: 'product',
    },
    orderBy: { scannedAt: 'desc' },
    include: {
      staffMember: {
        include: { zone: true, role: true },
      },
    },
  });

  if (!latestScan) {
    return {
      bar_name: null,
      scanner_id: null,
      last_used_at_label: null,
    };
  }

  return {
    bar_name: latestScan.barName ?? latestScan.staffMember.zone.label,
    scanner_id: formatValidatorDetail(latestScan.staffMember),
    last_used_at_label: formatTimeLabel(
      latestScan.lastUsedAt ?? latestScan.scannedAt,
      'CL',
    ),
  };
}

async function resolveDuplicateAttempt(manualEntryId: string) {
  const duplicateLog = await prisma.staffScanLog.findFirst({
    where: {
      entryId: manualEntryId,
      scanType: 'product',
      outcome: 'already_used',
    },
    orderBy: { scannedAt: 'desc' },
  });

  return Boolean(duplicateLog);
}

async function resolveRecentEvents(redemption: DrinkRedemptionWithContext) {
  const logs = await prisma.staffScanLog.findMany({
    where: {
      entryId: redemption.manualEntryId,
      scanType: 'product',
    },
    orderBy: { scannedAt: 'desc' },
    take: 5,
    include: {
      staffMember: {
        include: { zone: true, role: true },
      },
    },
  });

  return logs
    .slice()
    .reverse()
    .map((log) => ({
      kind:
        log.outcome === 'already_used'
          ? ('duplicate' as const)
          : log.outcome === 'supervisor_resolved'
            ? ('supervisor' as const)
            : ('validated' as const),
      time_label: formatTimeLabel(log.scannedAt, redemption.order.event.countryCode),
      detail: log.barName ?? formatValidatorDetail(log.staffMember),
      occurred_at: log.scannedAt.toISOString(),
    }));
}

function formatDrinkSearchSummary(redemption: DrinkRedemptionWithContext) {
  const line = resolveRedemptionLine(redemption);
  const status = resolveDrinkStatus(redemption);

  return {
    redemption_id: redemption.id,
    order_id: redemption.orderId,
    line_id: redemption.lineId,
    guest_name: redemption.order.user.fullName,
    guest_phone: formatGuestPhone(redemption.order.user),
    product_name: line?.productName ?? 'Product',
    product_quantity: line?.quantity ?? 1,
    qr_id: redemption.manualEntryId,
    qr_payload: redemption.qrPayload,
    order_code: formatDrinkOrderCode(redemption.orderId),
    consumption_id: redemption.manualEntryId,
    status,
    validated_at_label: redemption.validatedAt
      ? formatTimeLabel(redemption.validatedAt, redemption.order.event.countryCode)
      : null,
    bar_name: null,
    scanner_id: null,
    is_validated: Boolean(redemption.validatedAt),
    is_blocked: false,
    event_id: redemption.order.eventId,
    event_title: redemption.order.event.title,
    recent_events: [],
  };
}

async function formatDrinkSearchDetail(redemption: DrinkRedemptionWithContext) {
  const summary = formatDrinkSearchSummary(redemption);
  const barContext = await resolveBarContext(redemption.manualEntryId);
  const hasDuplicateAttempt = await resolveDuplicateAttempt(redemption.manualEntryId);
  const recentEvents = await resolveRecentEvents(redemption);

  return {
    ...summary,
    bar_name: barContext.bar_name,
    scanner_id: barContext.scanner_id,
    last_used_at_label: redemption.validatedAt
      ? formatTimeLabel(redemption.validatedAt, redemption.order.event.countryCode)
      : barContext.last_used_at_label,
    last_id_digits: formatLastIdDigits(redemption),
    is_document_confirmed: false,
    is_qr_unavailable: !redemption.validatedAt && redemption.unlockAt <= new Date(),
    is_blocked: hasDuplicateAttempt && redemption.order.status === 'confirmed',
    recent_events: recentEvents,
  };
}

export function formatDrinkSearchSummaries(redemptions: DrinkRedemptionWithContext[]) {
  const results = redemptions.map((redemption) => formatDrinkSearchSummary(redemption));
  return {
    results,
    total: results.length,
  };
}

export async function formatDrinkSearchDetailResponse(redemptionId: string) {
  const redemption = await loadDrinkRedemptionById(redemptionId);

  if (!redemption) {
    return null;
  }

  return formatDrinkSearchDetail(redemption);
}

export { searchSupervisorDrinks };
