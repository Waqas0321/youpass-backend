import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const ENTRY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateEntryCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ENTRY_CHARS[crypto.randomInt(0, ENTRY_CHARS.length)]!;
  }
  return code;
}

export function generateQrPayload(ticketId: string, eventId: string): string {
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${ticketId}.${eventId}`)
    .digest('hex')
    .slice(0, 10);
  return `${ticketId}.${eventId}.${signature}`;
}

export function detectCardBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.startsWith('4')) return 'visa';
  if (digits.startsWith('5')) return 'mastercard';
  if (digits.startsWith('3')) return 'amex';
  return 'card';
}

export function maskCardLastFour(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  return digits.slice(-4);
}

export function eventDayStart(date: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return new Date(`${year}-${month}-${day}T00:00:00`);
}

export function formatDateTimeLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', ' ·');
}

export function formatDeadlineLabel(date: Date, timezone: string): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `Until ${formatted.replace(',', ' ·')}`;
}

export type QrStatus = 'locked' | 'available' | 'redeemed' | 'expired';

export function resolveQrStatus(
  unlockAt: Date,
  validatedAt: Date | null,
  eventStartsAt: Date,
): QrStatus {
  if (validatedAt) return 'redeemed';
  const eventEnd = new Date(eventStartsAt.getTime() + 24 * 60 * 60 * 1000);
  if (new Date() > eventEnd) return 'expired';

  // Local dev: show QR immediately after confirm (production unlocks at 00:00 event day).
  if (env.NODE_ENV === 'development' && env.CHECKOUT_MOCK_PAYMENT) {
    return 'available';
  }

  if (new Date() < unlockAt) return 'locked';
  return 'available';
}
