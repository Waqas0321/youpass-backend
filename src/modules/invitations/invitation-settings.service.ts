import type { InvitationProductType, InvitationSettings } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const INVITATION_SETTINGS_DEFAULTS = {
  allowFree: true,
  allowGuaranteed: true,
  allowDiscount: true,
  freeCancellationDays: 7,
  guaranteedCancellationDays: 3,
  discountCancellationDays: 2,
  discountPercentage: null as number | null,
  enableWaitingList: true,
  enableManualReinvitation: true,
  waitlistOfferHours: 4,
  courtesySlotsTotal: 0,
} as const;

export const ALLOWED_DISCOUNT_PERCENTAGES = [10, 25, 50, 75] as const;

export async function ensureInvitationSettings(eventId: string): Promise<InvitationSettings> {
  return prisma.invitationSettings.upsert({
    where: { eventId },
    create: {
      eventId,
      ...INVITATION_SETTINGS_DEFAULTS,
    },
    update: {},
  });
}

export async function getInvitationSettings(eventId: string): Promise<InvitationSettings> {
  const existing = await prisma.invitationSettings.findUnique({ where: { eventId } });
  if (existing) {
    return existing;
  }
  return ensureInvitationSettings(eventId);
}

export function resolveCancellationDays(
  settings: InvitationSettings,
  type: InvitationProductType,
): number {
  switch (type) {
    case 'guaranteed':
      return settings.guaranteedCancellationDays;
    case 'discount':
      return settings.discountCancellationDays;
    default:
      return settings.freeCancellationDays;
  }
}

export function assertInvitationTypeAllowed(
  settings: InvitationSettings,
  type: InvitationProductType,
): void {
  if (type === 'free' && !settings.allowFree) {
    throw new Error('FREE_INVITATIONS_DISABLED');
  }
  if (type === 'guaranteed' && !settings.allowGuaranteed) {
    throw new Error('GUARANTEED_INVITATIONS_DISABLED');
  }
  if (type === 'discount' && !settings.allowDiscount) {
    throw new Error('DISCOUNT_INVITATIONS_DISABLED');
  }
}

export function resolveDiscountPercentage(
  settings: InvitationSettings,
  requested?: number | null,
): number {
  const value = requested ?? settings.discountPercentage ?? 25;
  if (!ALLOWED_DISCOUNT_PERCENTAGES.includes(value as (typeof ALLOWED_DISCOUNT_PERCENTAGES)[number])) {
    throw new Error('INVALID_DISCOUNT_PERCENTAGE');
  }
  return value;
}

export const invitationSettingsService = {
  ensureInvitationSettings,
  getInvitationSettings,
  resolveCancellationDays,
  assertInvitationTypeAllowed,
  resolveDiscountPercentage,
};
