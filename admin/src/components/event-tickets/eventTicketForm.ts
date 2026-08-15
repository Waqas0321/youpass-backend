import type { AdminTicketOfferingInput } from '../../api/client';
import type { EventTicketRow } from './eventTicketsData';

export type TicketFormState = {
  name: string;
  price: string;
  stock: string;
  validFromDate: string;
  validFromTime: string;
  validToTime: string;
  expiryDate: string;
  expiryTime: string;
  description: string;
  showInApp: boolean;
  featured: boolean;
  limitPerUser: string;
  unlimitedPerUser: boolean;
  promoCodeRequired: boolean;
  color: string;
  imageUrl: string;
  offeringType: AdminTicketOfferingInput['type'] | '';
};

export const TICKET_DESCRIPTION_MAX = 500;
export const TICKET_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const EMPTY_TICKET_FORM: TicketFormState = {
  name: '',
  price: '0',
  stock: '0',
  validFromDate: '',
  validFromTime: '00:00',
  validToTime: '23:59',
  expiryDate: '',
  expiryTime: '23:59',
  description: '',
  showInApp: true,
  featured: false,
  limitPerUser: '0',
  unlimitedPerUser: true,
  promoCodeRequired: false,
  color: '#8A2BE2',
  imageUrl: '',
  offeringType: '',
};

function splitIsoDateTime(iso: string | null) {
  if (!iso) {
    return { date: '', time: '' };
  }
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function ticketRowToFormState(ticket: EventTicketRow): TicketFormState {
  const saleStart = splitIsoDateTime(ticket.saleStart);
  const saleEnd = splitIsoDateTime(ticket.saleEnd);

  return {
    name: ticket.name,
    price: String(ticket.price),
    stock: ticket.stockTotal != null ? String(ticket.stockTotal) : '0',
    validFromDate: saleStart.date,
    validFromTime: saleStart.time || '00:00',
    validToTime: '23:59',
    expiryDate: saleEnd.date,
    expiryTime: saleEnd.time || '23:59',
    description: '',
    showInApp: ticket.backendStatus !== 'closed',
    featured: false,
    limitPerUser: '0',
    unlimitedPerUser: true,
    promoCodeRequired: false,
    color: ticket.color,
    imageUrl: '',
    offeringType: ticket.offeringType,
  };
}

export function mergeTicketDateTime(date: string, time: string) {
  if (!date) {
    return null;
  }
  return new Date(`${date}T${time || '00:00'}`).toISOString();
}

export function mapTicketFormToOfferingInput(
  form: TicketFormState,
  status: AdminTicketOfferingInput['status'] = 'active',
): AdminTicketOfferingInput {
  const stockValue = Number(form.stock);
  const stockTotal = stockValue > 0 ? stockValue : null;

  return {
    type: form.offeringType as AdminTicketOfferingInput['type'],
    name: form.name.trim(),
    price: Number(form.price) || 0,
    stock_total: stockTotal,
    stock_remaining: stockTotal,
    sale_start_at: mergeTicketDateTime(form.validFromDate, form.validFromTime),
    sale_end_at: mergeTicketDateTime(form.expiryDate, form.expiryTime),
    status,
    display_order: 0,
  };
}
