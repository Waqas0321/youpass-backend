import type { EventTicketOffering, TicketOfferingStatus, TicketOfferingType } from '@prisma/client';
import type { InvitationTier, TicketCatalogType } from '@prisma/client';

export const GENERAL_OFFERING_TYPES: TicketOfferingType[] = [
  'early_bird',
  'preventa_2',
  'preventa_3',
  'general',
];

export const VIP_OFFERING_TYPES: TicketOfferingType[] = ['vip_general'];

export const LEGACY_SLUG_TO_TYPE: Record<string, TicketOfferingType> = {
  'preventa-1': 'early_bird',
  'preventa-2': 'preventa_2',
  'preventa-3': 'preventa_3',
  'general-cover': 'general',
  'vip-general': 'vip_general',
};

export const TYPE_LABELS: Record<TicketOfferingType, string> = {
  early_bird: 'Early Bird',
  preventa_2: 'Pre-sale 2nd wave',
  preventa_3: 'Pre-sale 3rd wave',
  general: 'General',
  vip_general: 'VIP General',
};

export function offeringSection(type: TicketOfferingType): 'general' | 'vip' {
  return type === 'vip_general' ? 'vip' : 'general';
}

export function mapsToTier(type: TicketOfferingType): InvitationTier {
  return type === 'vip_general' ? 'vip' : 'general';
}

export function mapsToCatalogType(type: TicketOfferingType): TicketCatalogType {
  return type === 'vip_general' ? 'vip' : 'general';
}

export function soldQuantity(offering: Pick<EventTicketOffering, 'stockTotal' | 'stockRemaining'>) {
  if (offering.stockTotal == null || offering.stockRemaining == null) {
    return 0;
  }
  return Math.max(0, offering.stockTotal - offering.stockRemaining);
}

export function isStockSoldOut(
  offering: Pick<EventTicketOffering, 'stockTotal' | 'stockRemaining' | 'status'>,
) {
  if (offering.status === 'sold_out') return true;
  if (offering.stockRemaining != null && offering.stockRemaining <= 0) return true;
  if (
    offering.stockTotal != null &&
    offering.stockRemaining != null &&
    offering.stockRemaining <= 0
  ) {
    return true;
  }
  return false;
}

export function resolveOfferingRef(ref: string): TicketOfferingType | null {
  if (
    ref === 'early_bird' ||
    ref === 'preventa_2' ||
    ref === 'preventa_3' ||
    ref === 'general' ||
    ref === 'vip_general'
  ) {
    return ref;
  }
  return LEGACY_SLUG_TO_TYPE[ref] ?? null;
}

export function resolveOfferingAvailability(
  offering: EventTicketOffering,
  now = new Date(),
) {
  const stockSoldOut = isStockSoldOut(offering);
  const saleNotStarted = offering.saleStartAt != null && offering.saleStartAt > now;
  const saleExpired = offering.saleEndAt != null && offering.saleEndAt < now;
  const is_sold_out =
    stockSoldOut ||
    offering.status === 'sold_out' ||
    offering.status === 'closed' ||
    saleExpired;
  const is_selectable =
    offering.status === 'active' &&
    !stockSoldOut &&
    !saleExpired &&
    !saleNotStarted;

  return { is_sold_out, is_selectable, stockSoldOut, saleExpired, saleNotStarted };
}

export function isQuantityAvailable(
  offering: Pick<EventTicketOffering, 'stockRemaining'>,
  quantity: number,
) {
  if (offering.stockRemaining == null) return true;
  return quantity <= offering.stockRemaining;
}

export function normalizeStatusAfterStockChange(
  status: TicketOfferingStatus,
  stockRemaining: number | null,
): TicketOfferingStatus {
  if (stockRemaining != null && stockRemaining <= 0) {
    return 'sold_out';
  }
  if (status === 'sold_out' && stockRemaining != null && stockRemaining > 0) {
    return 'active';
  }
  return status;
}
