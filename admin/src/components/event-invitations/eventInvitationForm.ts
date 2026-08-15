import type { CreateInvitationBody } from '../../api/client';
import type { InvitationDisplayStatus } from './eventInvitationsUtils';

export function normalizeInvitationPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (raw.trim().startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith('56')) {
    return `+${digits}`;
  }

  return `+56${digits}`;
}

export function mapUiTypeToApiType(
  uiType: string,
): CreateInvitationBody['type'] {
  switch (uiType) {
    case 'vip':
    case 'vip_table':
      return 'guaranteed';
    case 'backstage':
    case 'general':
    default:
      return 'free';
  }
}

export function buildSlotLabel(listAssignment: string, uiType: string) {
  const list = listAssignment.trim();
  if (uiType === 'vip_table') {
    return list ? `${list} · Mesa VIP` : 'Mesa VIP';
  }
  if (uiType === 'backstage') {
    return list ? `${list} · Backstage` : 'Backstage';
  }
  if (uiType === 'vip') {
    return list ? `${list} · VIP` : 'VIP invitados';
  }
  return list || 'General';
}

export function buildCreateInvitationBody(input: {
  eventId: string;
  name: string;
  phone: string;
  listAssignment: string;
  invitationType: string;
  userId?: string;
  message?: string;
}): CreateInvitationBody {
  const phone = normalizeInvitationPhone(input.phone);

  return {
    event_id: input.eventId,
    type: mapUiTypeToApiType(input.invitationType),
    slot_label: buildSlotLabel(input.listAssignment, input.invitationType),
    ...(input.userId ? { recipient_user_id: input.userId } : { recipient_phone: phone }),
    recipient_name: input.name.trim(),
    personalised_message: input.message?.trim() || undefined,
  };
}

export const INVITATION_STATUS_FILTER_OPTIONS: InvitationDisplayStatus[] = [
  'pending',
  'confirmed',
  'rejected',
  'entered',
  'no_show',
  'invalid_qr',
];

export function filterByDisplayStatus<T extends { lifecycle_state: string; entry_at?: string | null; qr_status?: string | null }>(
  invitations: T[],
  statuses: Set<InvitationDisplayStatus>,
  resolveStatus: (invitation: T) => InvitationDisplayStatus,
) {
  if (statuses.size === 0) {
    return invitations;
  }

  return invitations.filter((invitation) => statuses.has(resolveStatus(invitation)));
}
