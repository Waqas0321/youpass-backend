import type {
  InvitationProductType,
  InvitationSource,
  InvitationTier,
} from '@prisma/client';

/** Section 14.1 / 14.7 — guest-facing invitation product kinds. */
export type InvitationProductKind = 'free' | 'guaranteed_pass' | 'discounted';

export const INVITATION_PRODUCT_COLORS: Record<InvitationProductKind, string> = {
  free: '#2E7D32',
  guaranteed_pass: '#E5A024',
  discounted: '#7B1FA2',
};

export const INVITATION_PRODUCT_LABELS: Record<InvitationProductKind, string> = {
  free: 'Free Invitation',
  guaranteed_pass: 'Guaranteed Pass',
  discounted: 'Discounted Invitation',
};

export const GUEST_ASSIGNMENT_PRODUCT_LABELS = {
  vip: 'VIP Invitation',
  general: 'Invitation',
} as const;

type InvitationKindInput = {
  type: InvitationProductType;
  source?: InvitationSource;
  tier?: InvitationTier;
  entryValue: number;
  amountToPay: number;
  inviterUserId?: string | null;
  recipientUserId?: string | null;
};

export function resolveInvitationProductKind(
  invitation: InvitationKindInput,
): InvitationProductKind {
  if (invitation.type === 'discount') {
    return 'discounted';
  }
  if (invitation.type === 'guaranteed') {
    return 'guaranteed_pass';
  }
  return 'free';
}

export function resolveInvitationProductLabel(invitation: InvitationKindInput): string {
  const productKind = resolveInvitationProductKind(invitation);

  if (productKind === 'discounted') {
    return INVITATION_PRODUCT_LABELS.discounted;
  }

  if (productKind === 'guaranteed_pass') {
    return INVITATION_PRODUCT_LABELS.guaranteed_pass;
  }

  if (invitation.source === 'producer') {
    return INVITATION_PRODUCT_LABELS.free;
  }

  if (invitation.source === 'guest') {
    if (invitation.entryValue <= 0) {
      return INVITATION_PRODUCT_LABELS.free;
    }

    return invitation.tier === 'vip'
      ? GUEST_ASSIGNMENT_PRODUCT_LABELS.vip
      : GUEST_ASSIGNMENT_PRODUCT_LABELS.general;
  }

  return INVITATION_PRODUCT_LABELS.free;
}

export function productKindFields(invitation: InvitationKindInput) {
  const productKind = resolveInvitationProductKind(invitation);
  return {
    product_kind: productKind,
    product_label: resolveInvitationProductLabel(invitation),
    type_color: INVITATION_PRODUCT_COLORS[productKind],
  };
}

type InvitationPaymentPolicyInput = {
  type: InvitationProductType;
  source: InvitationSource;
  entryValue: number;
};

export function isPurchasedGuestAssignment(
  invitation: Pick<InvitationPaymentPolicyInput, 'type' | 'source'>,
): boolean {
  return invitation.type === 'free' && invitation.source === 'guest';
}

export function isZeroValueFreeInvitation(
  invitation: Pick<InvitationPaymentPolicyInput, 'type' | 'entryValue'>,
): boolean {
  return invitation.type === 'free' && invitation.entryValue <= 0;
}

export function isPaidGuestAssignment(
  invitation: InvitationPaymentPolicyInput,
): boolean {
  return (
    invitation.type === 'free' &&
    invitation.source === 'guest' &&
    invitation.entryValue > 0
  );
}

export function isProducerFreeWithNoShowPolicy(
  invitation: InvitationPaymentPolicyInput,
): boolean {
  return (
    invitation.type === 'free' &&
    invitation.source === 'producer' &&
    invitation.entryValue > 0
  );
}

export function requiresNoShowPreauth(invitation: InvitationPaymentPolicyInput): boolean {
  return (
    invitation.type === 'guaranteed' ||
    isProducerFreeWithNoShowPolicy(invitation)
  );
}

export function requiresPaymentMethod(
  type: InvitationProductType,
  source: InvitationSource = 'producer',
  entryValue = 0,
): boolean {
  if (type === 'guaranteed' || type === 'discount') {
    return true;
  }

  if (isPaidGuestAssignment({ type, source, entryValue })) {
    return false;
  }

  if (isZeroValueFreeInvitation({ type, entryValue })) {
    return true;
  }

  return isProducerFreeWithNoShowPolicy({ type, source, entryValue });
}

export function termsAcceptedRequired(
  type: InvitationProductType,
  source: InvitationSource = 'producer',
  entryValue = 0,
): boolean {
  if (type === 'guaranteed') {
    return true;
  }

  if (isPaidGuestAssignment({ type, source, entryValue })) {
    return false;
  }

  if (isZeroValueFreeInvitation({ type, entryValue })) {
    return true;
  }

  return isProducerFreeWithNoShowPolicy({ type, source, entryValue });
}
