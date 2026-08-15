import type { ProducerInvitation } from '../../api/client';

export type GuestListId =
  | 'all'
  | 'rrpp'
  | 'influencers'
  | 'staff'
  | 'sponsors'
  | 'artists'
  | 'vip';

export type InvitationDisplayStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'entered'
  | 'no_show'
  | 'invalid_qr';

export type InvitationQrDisplayStatus = 'valid' | 'used' | 'not_generated' | 'invalid';

export type InvitationProductDisplay =
  | 'general'
  | 'vip'
  | 'vip_table'
  | 'backstage';

export const GUEST_LISTS: Array<{
  id: GuestListId;
  color: string;
  match: RegExp;
}> = [
  { id: 'rrpp', color: '#a855f7', match: /rrpp/i },
  { id: 'influencers', color: '#ec4899', match: /influencer/i },
  { id: 'staff', color: '#3b82f6', match: /staff/i },
  { id: 'sponsors', color: '#22c55e', match: /sponsor|patroc/i },
  { id: 'artists', color: '#f97316', match: /artist|artista/i },
  { id: 'vip', color: '#eab308', match: /vip/i },
];

export function resolveGuestListId(invitation: ProducerInvitation): GuestListId | null {
  const slot = `${invitation.slot_label ?? invitation.assigned_slot ?? ''} ${invitation.tier ?? ''}`;
  const match = GUEST_LISTS.find((list) => list.match.test(slot));
  return match?.id ?? null;
}

export function resolveProductDisplay(invitation: ProducerInvitation): InvitationProductDisplay {
  const slot = `${invitation.slot_label ?? invitation.assigned_slot ?? ''}`.toLowerCase();
  if (slot.includes('backstage')) {
    return 'backstage';
  }
  if (slot.includes('mesa')) {
    return 'vip_table';
  }
  if (invitation.tier === 'vip' || slot.includes('vip')) {
    return 'vip';
  }
  return 'general';
}

export function resolveInvitationDisplayStatus(
  invitation: ProducerInvitation,
): InvitationDisplayStatus {
  const state = invitation.lifecycle_state;
  if (state === 'validated' || invitation.entry_at) {
    return 'entered';
  }
  if (state === 'accepted' || state === 'charged') {
    return 'confirmed';
  }
  if (state === 'rejected') {
    return 'rejected';
  }
  if (state === 'expired' || state === 'canceled' || state === 'failed') {
    return 'no_show';
  }
  if (invitation.qr_status === 'expired') {
    return 'invalid_qr';
  }
  return 'pending';
}

export function resolveQrDisplayStatus(invitation: ProducerInvitation): InvitationQrDisplayStatus {
  switch (invitation.qr_status) {
    case 'available':
      return 'valid';
    case 'redeemed':
      return 'used';
    case 'expired':
      return 'invalid';
    default:
      return 'not_generated';
  }
}

export function guestInitials(name?: string | null) {
  if (!name?.trim()) {
    return '?';
  }
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatEntryDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale !== 'es-CL',
  }).format(date);
  return `${datePart} · ${timePart}`;
}

export function countByGuestList(invitations: ProducerInvitation[]) {
  const counts: Record<GuestListId, number> = {
    all: invitations.length,
    rrpp: 0,
    influencers: 0,
    staff: 0,
    sponsors: 0,
    artists: 0,
    vip: 0,
  };

  for (const invitation of invitations) {
    const listId = resolveGuestListId(invitation);
    if (listId) {
      counts[listId] += 1;
    }
  }

  return counts;
}

export function filterByGuestList(invitations: ProducerInvitation[], listId: GuestListId) {
  if (listId === 'all') {
    return invitations;
  }
  return invitations.filter((invitation) => resolveGuestListId(invitation) === listId);
}

export function visiblePages(current: number, total: number) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current > 1) {
    pages.add(current - 1);
  }
  if (current < total) {
    pages.add(current + 1);
  }

  return [...pages].sort((left, right) => left - right);
}
