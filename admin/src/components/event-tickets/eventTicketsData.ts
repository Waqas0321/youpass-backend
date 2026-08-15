import type { AdminTicketOffering } from '../../api/client';

export type EventTicketStatus = 'active' | 'paused' | 'limited' | 'hidden' | 'sold_out';

export type EventTicketRow = {
  id: string;
  offeringType: AdminTicketOffering['type'];
  backendStatus: AdminTicketOffering['status'];
  name: string;
  subtitle: string;
  color: string;
  price: number;
  currency: string;
  stockRemaining: number | null;
  stockTotal: number | null;
  sold: number;
  status: EventTicketStatus;
  saleStart: string | null;
  saleEnd: string | null;
};

const TICKET_COLORS = ['#F2B705', '#7B5FF2', '#3B82F6', '#22C55E', '#F97316', '#EC4899', '#6B7280'];

const TYPE_SUBTITLE_KEYS: Record<AdminTicketOffering['type'], string> = {
  early_bird: 'eventTickets.typeSubtitle.general',
  preventa_2: 'eventTickets.typeSubtitle.general',
  preventa_3: 'eventTickets.typeSubtitle.general',
  general: 'eventTickets.typeSubtitle.general',
  vip_general: 'eventTickets.typeSubtitle.vip',
};

export function ticketSubtitleKey(type: AdminTicketOffering['type']) {
  return TYPE_SUBTITLE_KEYS[type] ?? 'eventTickets.typeSubtitle.general';
}

function resolveUiStatus(offering: AdminTicketOffering): EventTicketStatus {
  if (offering.status === 'closed') {
    return 'hidden';
  }
  if (offering.status === 'paused') {
    return 'paused';
  }
  if (offering.status === 'sold_out') {
    return 'sold_out';
  }

  const stockTotal = offering.stock_total;
  const stockRemaining = offering.stock_remaining;
  if (
    stockTotal != null &&
    stockTotal > 0 &&
    stockRemaining != null &&
    stockRemaining <= Math.ceil(stockTotal * 0.15)
  ) {
    return 'limited';
  }

  return 'active';
}

export function mapOfferingToTicketRow(
  offering: AdminTicketOffering,
  index: number,
): EventTicketRow {
  const stockTotal = offering.stock_total ?? null;
  const stockRemaining = offering.stock_remaining ?? stockTotal;
  const sold = offering.sold_quantity ?? (stockTotal != null && stockRemaining != null
    ? Math.max(stockTotal - stockRemaining, 0)
    : 0);

  return {
    id: offering.offering_id ?? offering.id,
    offeringType: offering.type,
    backendStatus: offering.status,
    name: offering.name,
    subtitle: ticketSubtitleKey(offering.type),
    color: TICKET_COLORS[index % TICKET_COLORS.length],
    price: offering.price,
    currency: offering.currency || 'CLP',
    stockRemaining,
    stockTotal,
    sold,
    status: resolveUiStatus(offering),
    saleStart: offering.sale_start_at ?? null,
    saleEnd: offering.sale_end_at ?? null,
  };
}
