import type { AdminTicketOfferingInput } from '../../api/client';
import {
  DEFAULT_EVENT_TIMEZONE,
  splitDatetimeLocal,
  toDatetimeLocalValue,
  zonedWallTimeToDate,
} from '../event-info/eventInfoForm';
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

// Sale dates are entered and shown in the event's timezone, not the admin's browser timezone.
function splitIsoDateTime(iso: string | null, timeZone: string) {
  if (!iso) {
    return { date: '', time: '' };
  }
  return splitDatetimeLocal(toDatetimeLocalValue(iso, timeZone));
}

export function ticketRowToFormState(
  ticket: EventTicketRow,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): TicketFormState {
  const saleStart = splitIsoDateTime(ticket.saleStart, timeZone);
  const saleEnd = splitIsoDateTime(ticket.saleEnd, timeZone);

  return {
    name: ticket.name,
    price: String(ticket.price),
    stock: ticket.stockTotal != null ? String(ticket.stockTotal) : '0',
    validFromDate: saleStart.date,
    validFromTime: saleStart.time || '00:00',
    validToTime: '23:59',
    expiryDate: saleEnd.date,
    expiryTime: saleEnd.time || '23:59',
    description: ticket.description,
    showInApp: ticket.backendStatus !== 'closed',
    featured: ticket.featured,
    limitPerUser: ticket.maxPerUser != null ? String(ticket.maxPerUser) : '0',
    unlimitedPerUser: ticket.maxPerUser == null,
    promoCodeRequired: false,
    color: ticket.color,
    imageUrl: ticket.imageUrl,
    offeringType: ticket.offeringType,
  };
}

export function mergeTicketDateTime(date: string, time: string, timeZone = DEFAULT_EVENT_TIMEZONE) {
  if (!date) {
    return null;
  }
  return zonedWallTimeToDate(`${date}T${time || '00:00'}`, timeZone).toISOString();
}

export function mapTicketFormToOfferingInput(
  form: TicketFormState,
  status: AdminTicketOfferingInput['status'] = 'active',
  timeZone = DEFAULT_EVENT_TIMEZONE,
): AdminTicketOfferingInput {
  const stockValue = Number(form.stock);
  const stockTotal = stockValue > 0 ? stockValue : null;

  return {
    type: form.offeringType as AdminTicketOfferingInput['type'],
    name: form.name.trim(),
    price: Number(form.price) || 0,
    stock_total: stockTotal,
    stock_remaining: stockTotal,
    sale_start_at: mergeTicketDateTime(form.validFromDate, form.validFromTime, timeZone),
    sale_end_at: mergeTicketDateTime(form.expiryDate, form.expiryTime, timeZone),
    status,
    display_order: 0,
    description: form.description.trim() || null,
    color: /^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : null,
    image_url: form.imageUrl || null,
    is_featured: form.featured,
    max_per_user: form.unlimitedPerUser ? null : Number(form.limitPerUser) > 0 ? Number(form.limitPerUser) : null,
  };
}
