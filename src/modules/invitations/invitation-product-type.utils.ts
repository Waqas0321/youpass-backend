import type { InvitationProductType } from '@prisma/client';

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

type InvitationKindInput = {
  type: InvitationProductType;
  entryValue: number;
  amountToPay: number;
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

export function productKindFields(invitation: InvitationKindInput) {
  const productKind = resolveInvitationProductKind(invitation);
  return {
    product_kind: productKind,
    product_label: INVITATION_PRODUCT_LABELS[productKind],
    type_color: INVITATION_PRODUCT_COLORS[productKind],
  };
}

export function requiresPaymentMethod(type: InvitationProductType): boolean {
  return type === 'guaranteed' || type === 'discount';
}

export function termsAcceptedRequired(type: InvitationProductType): boolean {
  return type === 'guaranteed';
}
