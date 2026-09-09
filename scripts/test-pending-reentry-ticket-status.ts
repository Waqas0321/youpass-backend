/**
 * Smoke checks for pending re-entry ticket/QR classification.
 * Run: npx tsx scripts/test-pending-reentry-ticket-status.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  hasPendingReentry,
  resolveQrStatus,
} from '../src/modules/invitations/invitations.utils.js';
import {
  isPastTicket,
  isUpcomingTicket,
  resolveTicketStatus,
} from '../src/modules/tickets/tickets.utils.js';

const now = new Date('2026-09-09T20:00:00.000Z');
const startsAt = new Date('2026-09-09T18:00:00.000Z');
const validatedAt = new Date('2026-09-09T19:00:00.000Z');
const unlockForReentry = new Date('2026-09-09T19:30:00.000Z');

assert.equal(hasPendingReentry(unlockForReentry, validatedAt), true);
assert.equal(hasPendingReentry(validatedAt, validatedAt), false);
assert.equal(
  resolveQrStatus(unlockForReentry, validatedAt, startsAt),
  'available',
);
assert.equal(resolveQrStatus(validatedAt, validatedAt, startsAt), 'redeemed');

const baseTicket = {
  id: 'tkt1',
  invitationId: 'inv1',
  manualEntryId: 'ABC123',
  qrPayload: 'qr',
  unlockAt: unlockForReentry,
  validatedAt,
  consumptionCount: 1,
  createdAt: now,
  updatedAt: now,
};
const baseEvent = {
  id: 'e1',
  title: 'Test Event',
  description: null,
  startsAt,
  endsAt: null,
  status: 'published' as const,
  venueName: 'Venue',
  city: 'Santiago',
  countryCode: 'CL',
  latitude: null,
  longitude: null,
  coverImageUrl: null,
  timezone: 'America/Santiago',
  eventTypeId: 'type1',
  producerId: 'prod1',
  venueId: null,
  venueKind: null,
  createdAt: now,
  updatedAt: now,
  eventType: { slug: 'parties', name: 'Parties' },
};
const pending = {
  id: 'inv1',
  eventId: 'e1',
  producerId: 'prod1',
  recipientPhone: '+56990000111',
  recipientUserId: 'user1',
  recipientName: 'Guest',
  type: 'free' as const,
  tier: 'general' as const,
  status: 'validated' as const,
  assignedSlot: 'General 1',
  entryValue: 0,
  amountToPay: 0,
  cancellationDeadline: now,
  source: 'guest' as const,
  inviterUserId: null,
  respondedAt: now,
  sentAt: now,
  viewedAt: null,
  chargedAt: null,
  canceledAt: null,
  expiresAt: null,
  chargeCurrency: 'CLP',
  createdAt: now,
  updatedAt: now,
  customMessage: null,
  event: baseEvent,
  producer: { id: 'prod1', name: 'Producer' },
  ticket: baseTicket,
} as any;

assert.equal(resolveTicketStatus(pending, pending.event, pending.ticket, now), 'active');
assert.equal(isUpcomingTicket(pending, now), true);
assert.equal(isPastTicket(pending, now), false);

const used = {
  ...pending,
  ticket: { ...baseTicket, unlockAt: validatedAt },
};
assert.equal(resolveTicketStatus(used, used.event, used.ticket, now), 'validated');
assert.equal(isUpcomingTicket(used, now), false);
assert.equal(isPastTicket(used, now), true);

console.log('pending re-entry ticket/QR classification checks passed');
