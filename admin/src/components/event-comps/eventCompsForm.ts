import type { CreateInvitationBody, ProducerInvitation, UpdateInvitationBody } from '../../api/client';
import { normalizeInvitationPhone } from '../event-invitations/eventInvitationForm';
import type { Comp, CompStatusId, CompTypeId } from './eventCompsUtils';

export const COMP_METADATA_PREFIX = '__COMP__';

export type CompMetadata = {
  kind: 'complimentary';
  comp_type: CompTypeId;
  benefit: string;
  issue_date: string;
  time_from: string;
  time_to: string;
  comp_code: string;
};

const COMP_TYPE_SLOT: Record<CompTypeId, string> = {
  general: 'Cortesía General',
  vip: 'Cortesía VIP',
  backstage: 'Cortesía Backstage',
  open_bar: 'Cortesía Open Bar',
  vip_table: 'Cortesía Mesa VIP',
};

const ENTRY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCompCode() {
  let suffix = '';
  for (let index = 0; index < 6; index += 1) {
    suffix += ENTRY_CODE_CHARS[Math.floor(Math.random() * ENTRY_CODE_CHARS.length)]!;
  }
  return `CRT-${suffix}`;
}

export function encodeCompMetadata(metadata: CompMetadata) {
  return `${COMP_METADATA_PREFIX}${JSON.stringify(metadata)}`;
}

export function decodeCompMetadata(raw?: string | null): CompMetadata | null {
  if (!raw?.startsWith(COMP_METADATA_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice(COMP_METADATA_PREFIX.length)) as CompMetadata;
    if (parsed?.kind !== 'complimentary' || !parsed.comp_code) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isCompInvitation(invitation: Pick<ProducerInvitation, 'custom_message'>) {
  return Boolean(decodeCompMetadata(invitation.custom_message));
}

export function resolveCompStatus(invitation: ProducerInvitation): CompStatusId {
  const state = invitation.lifecycle_state;
  if (state === 'rejected' || state === 'canceled') {
    return 'invalidated';
  }
  if (state === 'expired' || state === 'failed') {
    return 'expired';
  }
  if (state === 'validated' || invitation.entry_at) {
    return 'redeemed';
  }
  if (state === 'accepted' || state === 'charged') {
    if (invitation.qr_status === 'available') {
      return 'available';
    }
    if (invitation.qr_status === 'redeemed') {
      return 'redeemed';
    }
    return 'accepted';
  }
  if (state === 'sent' || state === 'viewed') {
    return 'sent';
  }
  return 'sent';
}

export function mapInvitationToComp(invitation: ProducerInvitation): Comp | null {
  const metadata = decodeCompMetadata(invitation.custom_message);
  if (!metadata) {
    return null;
  }

  return {
    id: invitation.id,
    code: metadata.comp_code,
    beneficiary_name: invitation.recipient_name ?? '—',
    phone: invitation.recipient_phone ?? '—',
    type: metadata.comp_type,
    benefit: metadata.benefit,
    status: resolveCompStatus(invitation),
    created_at: invitation.sent_at ?? new Date().toISOString(),
    used_at: invitation.entry_at ?? null,
    deep_link: invitation.deep_link,
    issue_date: metadata.issue_date,
    time_from: metadata.time_from,
    time_to: metadata.time_to,
  };
}

export function buildCreateCompBody(input: {
  eventId: string;
  name: string;
  phone: string;
  type: CompTypeId;
  benefit: string;
  issueDate: string;
  timeFrom: string;
  timeTo: string;
  userId?: string;
  compCode?: string;
}): CreateInvitationBody {
  const metadata: CompMetadata = {
    kind: 'complimentary',
    comp_type: input.type,
    benefit: input.benefit.trim(),
    issue_date: input.issueDate,
    time_from: input.timeFrom,
    time_to: input.timeTo,
    comp_code: input.compCode ?? generateCompCode(),
  };

  const phone = normalizeInvitationPhone(input.phone);

  return {
    event_id: input.eventId,
    type: 'free',
    slot_label: COMP_TYPE_SLOT[input.type],
    personalised_message: encodeCompMetadata(metadata),
    recipient_name: input.name.trim(),
    ...(input.userId ? { recipient_user_id: input.userId } : { recipient_phone: phone }),
  };
}

export function buildUpdateCompBody(input: {
  name: string;
  type: CompTypeId;
  benefit: string;
  issueDate: string;
  timeFrom: string;
  timeTo: string;
  existing?: CompMetadata | null;
}): UpdateInvitationBody {
  const metadata: CompMetadata = {
    kind: 'complimentary',
    comp_type: input.type,
    benefit: input.benefit.trim(),
    issue_date: input.issueDate,
    time_from: input.timeFrom,
    time_to: input.timeTo,
    comp_code: input.existing?.comp_code ?? generateCompCode(),
  };

  return {
    recipient_name: input.name.trim(),
    slot_label: COMP_TYPE_SLOT[input.type],
    personalised_message: encodeCompMetadata(metadata),
  };
}

export function countCompsByType(comps: Comp[]) {
  const counts: Record<CompTypeId, number> = {
    general: 0,
    vip: 0,
    backstage: 0,
    open_bar: 0,
    vip_table: 0,
  };

  for (const comp of comps) {
    counts[comp.type] += 1;
  }

  return counts;
}

export function countCompsByStatus(comps: Comp[]) {
  const counts: Record<CompStatusId, number> = {
    available: 0,
    sent: 0,
    accepted: 0,
    redeemed: 0,
    expired: 0,
    invalidated: 0,
  };

  for (const comp of comps) {
    counts[comp.status] += 1;
  }

  return counts;
}

export function filterCompsByStatus(comps: Comp[], statuses: Set<CompStatusId>) {
  if (statuses.size === 0) {
    return comps;
  }
  return comps.filter((comp) => statuses.has(comp.status));
}

export function filterCompsByType(comps: Comp[], type: CompTypeId | 'all') {
  if (type === 'all') {
    return comps;
  }
  return comps.filter((comp) => comp.type === type);
}
