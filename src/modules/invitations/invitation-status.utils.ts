import type { Invitation, InvitationProductType, InvitationStatus, InvitationTicket } from '@prisma/client';

/** Section 14.7 — DB status values (also exposed as lifecycle_state in API). */
export type InvitationLifecycleState = InvitationStatus;

type StatusInput = Pick<Invitation, 'status' | 'viewedAt'> & {
  ticket?: Pick<InvitationTicket, 'validatedAt'> | null;
};

export function resolveInvitationLifecycleState(invitation: StatusInput): InvitationLifecycleState {
  if (invitation.status === 'validated' || invitation.ticket?.validatedAt) {
    return 'validated';
  }
  if (invitation.status === 'sent' && invitation.viewedAt) {
    return 'viewed';
  }
  return invitation.status;
}

export function lifecycleStateLabel(state: InvitationLifecycleState): string {
  const labels: Record<InvitationLifecycleState, string> = {
    sent: 'Sent',
    viewed: 'Viewed',
    accepted: 'Accepted',
    rejected: 'Rejected',
    expired: 'Expired',
    canceled: 'Canceled',
    validated: 'Validated',
    charged: 'Charged',
    failed: 'Failed',
  };
  return labels[state];
}

export function mapListFilterToStatuses(
  filter: 'active' | 'pending' | 'accepted' | 'history',
): InvitationStatus[] | null {
  switch (filter) {
    case 'active':
      return ['sent', 'viewed', 'accepted'];
    case 'pending':
      return ['sent', 'viewed'];
    case 'accepted':
      return ['accepted', 'validated'];
    case 'history':
      return ['rejected', 'expired', 'canceled', 'validated', 'charged', 'failed'];
    default:
      return null;
  }
}

export function mapLegacyStatusToDb(status: string): InvitationStatus | null {
  switch (status) {
    case 'pending':
      return 'sent';
    case 'confirmed':
      return 'accepted';
    case 'cancelled':
      return 'canceled';
    default:
      if (
        ['sent', 'viewed', 'accepted', 'rejected', 'expired', 'canceled', 'validated', 'charged', 'failed'].includes(
          status,
        )
      ) {
        return status as InvitationStatus;
      }
      return null;
  }
}

export function mapApiStatus(status: InvitationStatus): string {
  return status === 'canceled' ? 'canceled' : status;
}

export function formatLifecycleStatus(
  invitation: StatusInput & { preAuth?: { status: string } | null },
) {
  const state = resolveInvitationLifecycleState(invitation);
  return {
    lifecycle_state: state,
    lifecycle_label: lifecycleStateLabel(state),
    db_status: invitation.status,
    is_charged: invitation.status === 'charged',
    is_failed: invitation.status === 'failed',
    preauth_active: invitation.preAuth?.status === 'pre_authorized',
  };
}

export function mapApiTypeToDb(type: 'free' | 'guaranteed' | 'discounted'): InvitationProductType {
  if (type === 'guaranteed') return 'guaranteed';
  if (type === 'discounted') return 'discount';
  return 'free';
}

export function mapDbTypeToApi(type: InvitationProductType): 'free' | 'guaranteed' | 'discounted' {
  if (type === 'guaranteed') return 'guaranteed';
  if (type === 'discount') return 'discounted';
  return 'free';
}
