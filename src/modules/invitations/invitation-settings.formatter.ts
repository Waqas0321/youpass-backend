import type { InvitationSettings } from '@prisma/client';

export function formatInvitationSettingsResponse(settings: InvitationSettings) {
  return {
    event_id: settings.eventId,
    allow_free: settings.allowFree,
    allow_guaranteed: settings.allowGuaranteed,
    allow_discount: settings.allowDiscount,
    free_cancellation_days: settings.freeCancellationDays,
    guaranteed_cancellation_days: settings.guaranteedCancellationDays,
    discount_cancellation_days: settings.discountCancellationDays,
    discount_percentage: settings.discountPercentage,
    enable_waiting_list: settings.enableWaitingList,
    enable_manual_reinvitation: settings.enableManualReinvitation,
    waitlist_offer_hours: settings.waitlistOfferHours,
    courtesy_slots_total: settings.courtesySlotsTotal,
    updated_at: settings.updatedAt.toISOString(),
  };
}

export function invitationSettingsUpdateData(
  input: {
    allow_free: boolean;
    allow_guaranteed: boolean;
    allow_discount: boolean;
    free_cancellation_days: number;
    guaranteed_cancellation_days: number;
    discount_cancellation_days: number;
    discount_percentage?: number | null;
    enable_waiting_list?: boolean;
    enable_manual_reinvitation?: boolean;
    waitlist_offer_hours?: number;
    courtesy_slots_total?: number;
  },
  defaults: {
    enableWaitingList: boolean;
    enableManualReinvitation: boolean;
    waitlistOfferHours: number;
    courtesySlotsTotal: number;
  },
) {
  return {
    allowFree: input.allow_free,
    allowGuaranteed: input.allow_guaranteed,
    allowDiscount: input.allow_discount,
    freeCancellationDays: input.free_cancellation_days,
    guaranteedCancellationDays: input.guaranteed_cancellation_days,
    discountCancellationDays: input.discount_cancellation_days,
    discountPercentage: input.discount_percentage ?? null,
    enableWaitingList: input.enable_waiting_list ?? defaults.enableWaitingList,
    enableManualReinvitation:
      input.enable_manual_reinvitation ?? defaults.enableManualReinvitation,
    waitlistOfferHours: input.waitlist_offer_hours ?? defaults.waitlistOfferHours,
    courtesySlotsTotal: input.courtesy_slots_total ?? defaults.courtesySlotsTotal,
  };
}
