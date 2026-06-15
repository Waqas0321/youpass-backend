import type { Event, InvitationSettings, User, WaitlistEntry, WaitlistOffer } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  INVITATION_SETTINGS_DEFAULTS,
  invitationSettingsService,
} from '../invitations/invitation-settings.service.js';
import { markFreedSlotReinvited } from '../invitations/invitation-freed-slot.service.js';
import { producerInvitationsService } from '../producer-invitations/producer-invitations.service.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';
import { formatInvitationListItem } from '../invitations/invitations.formatter.js';
import { formatDateTimeLabel, formatDeadlineLabel } from '../invitations/invitations.utils.js';
import { getTimezone } from '../invitations/invitations.formatter.js';
import { waitlistNotificationService } from './waitlist-notification.service.js';

const ACTIVE_COURTESY_STATUSES = ['sent', 'viewed', 'accepted', 'validated', 'charged'] as const;

type WaitlistEntryWithRelations = WaitlistEntry & {
  event: Event;
  user: User;
  offers: WaitlistOffer[];
};

async function loadEventOrThrow(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status === 'cancelled') {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

async function resolveCourtesySlotsTotal(
  eventId: string,
  settings: InvitationSettings,
): Promise<number> {
  if (settings.courtesySlotsTotal > 0) {
    return settings.courtesySlotsTotal;
  }

  const slots = await prisma.invitation.findMany({
    where: { eventId, source: 'producer', type: 'guaranteed' },
    distinct: ['assignedSlot'],
    select: { assignedSlot: true },
  });

  return slots.length;
}

async function countActiveCourtesyInvitations(eventId: string): Promise<number> {
  return prisma.invitation.count({
    where: {
      eventId,
      source: 'producer',
      type: 'guaranteed',
      status: { in: [...ACTIVE_COURTESY_STATUSES] },
    },
  });
}

async function countUnreinvitedFreedSlots(eventId: string): Promise<number> {
  return prisma.freedInvitationSlot.count({
    where: { eventId, reinvitedAt: null },
  });
}

export async function isCourtesySlotsFull(eventId: string): Promise<boolean> {
  const settings = await invitationSettingsService.getInvitationSettings(eventId);
  if (!settings.enableWaitingList || !settings.allowGuaranteed) {
    return false;
  }

  const total = await resolveCourtesySlotsTotal(eventId, settings);
  if (total <= 0) {
    return false;
  }

  const [active, freed] = await Promise.all([
    countActiveCourtesyInvitations(eventId),
    countUnreinvitedFreedSlots(eventId),
  ]);

  return active + freed >= total;
}

async function userHasActiveCourtesyInvitation(eventId: string, userId: string, userPhone: string) {
  const existing = await prisma.invitation.findFirst({
    where: {
      eventId,
      type: 'guaranteed',
      status: { in: [...ACTIVE_COURTESY_STATUSES] },
      OR: [{ recipientUserId: userId }, { recipientPhone: userPhone, recipientUserId: null }],
    },
  });
  return existing != null;
}

async function getUserWaitlistEntry(eventId: string, userId: string) {
  return prisma.waitlistEntry.findUnique({
    where: { eventId_userId: { eventId, userId } },
    include: { offers: { orderBy: { offeredAt: 'desc' } } },
  });
}

export async function computeQueuePosition(eventId: string, entryId: string): Promise<number> {
  const waiting = await prisma.waitlistEntry.findMany({
    where: { eventId, status: 'waiting' },
    orderBy: { joinedAt: 'asc' },
    select: { id: true },
  });

  const index = waiting.findIndex((entry) => entry.id === entryId);
  return index >= 0 ? index + 1 : 0;
}

export async function estimateJoinPosition(eventId: string): Promise<number> {
  const waitingCount = await prisma.waitlistEntry.count({
    where: { eventId, status: 'waiting' },
  });
  return waitingCount + 1;
}

function formatCountdown(expiresAt: Date, now = new Date()) {
  const ms = Math.max(0, expiresAt.getTime() - now.getTime());
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return {
    expires_in_ms: ms,
    expires_in_hours: hours,
    expires_in_minutes: minutes,
    expires_in_label: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
  };
}

export function formatWaitlistEntryCard(
  entry: WaitlistEntryWithRelations,
  position: number,
  activeOffer: WaitlistOffer | null,
  offerHours: number,
) {
  const timezone = getTimezone(entry.event.countryCode);
  const base = {
    id: entry.id,
    kind: 'waitlist' as const,
    event_id: entry.eventId,
    event_title: entry.event.title,
    location: `${entry.event.venueName}, ${entry.event.city}`,
    date_time_label: formatDateTimeLabel(entry.event.startsAt, timezone),
    image_url: entry.event.imageUrl,
    tier: 'vip' as const,
    type: 'guaranteed',
    product_kind: 'guaranteed_pass',
    product_label: 'Courtesy',
    status: entry.status,
    joined_at: entry.joinedAt.toISOString(),
    position,
    offer_hours: offerHours,
    can_leave: entry.status === 'waiting',
    can_claim: false,
    badge: 'WAITING LIST',
    status_label: `You are #${position} on the waiting list`,
  };

  if (activeOffer && activeOffer.status === 'active' && activeOffer.expiresAt > new Date()) {
    const countdown = formatCountdown(activeOffer.expiresAt);
    return {
      ...base,
      offer_id: activeOffer.id,
      badge: 'SLOT AVAILABLE — ACT NOW ⚡',
      status_label: `Expires in ${countdown.expires_in_label}`,
      expires_at: activeOffer.expiresAt.toISOString(),
      expires_at_label: formatDeadlineLabel(activeOffer.expiresAt, timezone),
      ...countdown,
      can_claim: true,
      can_leave: false,
      is_urgent: true,
    };
  }

  return base;
}

async function getActiveOfferForEntry(entry: WaitlistEntryWithRelations) {
  return (
    entry.offers.find(
      (offer) => offer.status === 'active' && offer.expiresAt > new Date(),
    ) ?? null
  );
}

export async function formatUserWaitlistStatus(eventId: string, userId: string) {
  const settings = await invitationSettingsService.getInvitationSettings(eventId);
  const entry = await getUserWaitlistEntry(eventId, userId);
  const joinable = await isCourtesySlotsFull(eventId);

  if (!entry || ['left', 'expired_removed', 'claimed'].includes(entry.status)) {
    return {
      enabled: settings.enableWaitingList && settings.allowGuaranteed,
      joinable,
      status: null as string | null,
      position: null as number | null,
      offer_id: null as string | null,
      offer_expires_at: null as string | null,
      can_join: joinable && settings.enableWaitingList,
      can_leave: false,
      offer_hours: settings.waitlistOfferHours,
    };
  }

  const activeOffer = await getActiveOfferForEntry(entry as WaitlistEntryWithRelations);
  const position =
    entry.status === 'waiting'
      ? await computeQueuePosition(eventId, entry.id)
      : null;

  return {
    enabled: settings.enableWaitingList && settings.allowGuaranteed,
    joinable,
    status: entry.status,
    position,
    offer_id: activeOffer?.id ?? null,
    offer_expires_at: activeOffer?.expiresAt.toISOString() ?? null,
    can_join: false,
    can_leave: entry.status === 'waiting',
    offer_hours: settings.waitlistOfferHours,
    ...(activeOffer ? formatCountdown(activeOffer.expiresAt) : {}),
  };
}

async function offerSlotToNextInQueue(
  slot: {
    id: string;
    eventId: string;
    producerId: string;
    slotLabel: string;
  },
  settings: InvitationSettings,
): Promise<void> {
  const activeOffer = await prisma.waitlistOffer.findFirst({
    where: { freedSlotId: slot.id, status: 'active' },
  });
  if (activeOffer) {
    return;
  }

  const entry = await prisma.waitlistEntry.findFirst({
    where: { eventId: slot.eventId, status: 'waiting' },
    orderBy: { joinedAt: 'asc' },
    include: { user: true, event: true },
  });

  if (!entry) {
    return;
  }

  const expiresAt = new Date(Date.now() + settings.waitlistOfferHours * 60 * 60 * 1000);

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.waitlistOffer.create({
      data: {
        eventId: slot.eventId,
        userId: entry.userId,
        waitlistEntryId: entry.id,
        freedSlotId: slot.id,
        slotLabel: slot.slotLabel,
        producerId: slot.producerId,
        expiresAt,
      },
    });

    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'offered' },
    });

    return created;
  });

  await waitlistNotificationService.sendSlotOffer({
    user: entry.user,
    event: entry.event,
    offer,
    offerHours: settings.waitlistOfferHours,
  });
}

export async function onSlotReleased(freedSlotId: string): Promise<void> {
  const slot = await prisma.freedInvitationSlot.findUnique({ where: { id: freedSlotId } });
  if (!slot || slot.reinvitedAt) {
    return;
  }

  const settings = await invitationSettingsService.getInvitationSettings(slot.eventId);
  if (!settings.enableWaitingList) {
    return;
  }

  await offerSlotToNextInQueue(slot, settings);
}

export async function processExpiredOffers(now = new Date()): Promise<number> {
  const expiredOffers = await prisma.waitlistOffer.findMany({
    where: { status: 'active', expiresAt: { lte: now } },
    include: {
      waitlistEntry: true,
      event: true,
    },
    orderBy: { expiresAt: 'asc' },
  });

  let processed = 0;

  for (const offer of expiredOffers) {
    const user = await prisma.user.findUnique({ where: { id: offer.userId } });
    if (!user) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.waitlistOffer.update({
        where: { id: offer.id },
        data: { status: 'expired', expiredAt: now },
      });
      await tx.waitlistEntry.update({
        where: { id: offer.waitlistEntryId },
        data: { status: 'expired_removed', removedAt: now },
      });
    });

    await waitlistNotificationService.sendOfferExpired({
      user,
      event: offer.event,
    });

    if (offer.freedSlotId) {
      const slot = await prisma.freedInvitationSlot.findUnique({
        where: { id: offer.freedSlotId },
      });
      if (slot && !slot.reinvitedAt) {
        const settings = await invitationSettingsService.getInvitationSettings(slot.eventId);
        await offerSlotToNextInQueue(slot, settings);
      }
    }

    processed += 1;
  }

  return processed;
}

export async function processOfferReminders(now = new Date()): Promise<number> {
  const settingsRows = await prisma.invitationSettings.findMany({
    where: { enableWaitingList: true },
    select: { eventId: true, waitlistOfferHours: true },
  });
  const offerHoursByEvent = new Map(settingsRows.map((row) => [row.eventId, row.waitlistOfferHours]));

  const offers = await prisma.waitlistOffer.findMany({
    where: {
      status: 'active',
      reminderSentAt: null,
      expiresAt: { gt: now },
    },
    include: { event: true },
  });

  let sent = 0;

  for (const offer of offers) {
    const offerHours = offerHoursByEvent.get(offer.eventId) ?? 4;
    const reminderAt = new Date(
      offer.expiresAt.getTime() - Math.min(60, offerHours) * 60 * 60 * 1000,
    );
    if (now < reminderAt) {
      continue;
    }

    const user = await prisma.user.findUnique({ where: { id: offer.userId } });
    if (!user) {
      continue;
    }

    await waitlistNotificationService.sendOfferReminder({ user, event: offer.event, offer });
    await prisma.waitlistOffer.update({
      where: { id: offer.id },
      data: { reminderSentAt: now },
    });
    sent += 1;
  }

  return sent;
}

export const waitlistService = {
  async getJoinPreview(eventId: string, userId: string, userPhone: string) {
    const event = await loadEventOrThrow(eventId);
    const settings = await invitationSettingsService.getInvitationSettings(eventId);

    if (!settings.enableWaitingList || !settings.allowGuaranteed) {
      throw new AppError(422, 'WAITLIST_DISABLED', 'Waiting list is not enabled for this event');
    }

    const full = await isCourtesySlotsFull(eventId);
    if (!full) {
      throw new AppError(409, 'WAITLIST_NOT_AVAILABLE', 'Courtesy slots are still available');
    }

    const existing = await getUserWaitlistEntry(eventId, userId);
    if (existing && ['waiting', 'offered'].includes(existing.status)) {
      throw new AppError(409, 'ALREADY_ON_WAITLIST', 'You are already on the waiting list');
    }

    if (await userHasActiveCourtesyInvitation(eventId, userId, userPhone)) {
      throw new AppError(409, 'ALREADY_HAS_COURTESY', 'You already have a courtesy invitation');
    }

    const estimatedPosition = await estimateJoinPosition(eventId);
    const timezone = getTimezone(event.countryCode);

    return {
      event_id: event.id,
      event_title: event.title,
      event_date_label: formatDateTimeLabel(event.startsAt, timezone),
      estimated_position: estimatedPosition,
      offer_hours: settings.waitlistOfferHours,
      message:
        'You will be automatically notified if a slot becomes available. ' +
        `You will have ${settings.waitlistOfferHours} hours to confirm before it passes to the next person.`,
    };
  },

  async join(eventId: string, userId: string, userPhone: string) {
    await this.getJoinPreview(eventId, userId, userPhone);

    const entry = await prisma.waitlistEntry.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: {
        eventId,
        userId,
        status: 'waiting',
        joinedAt: new Date(),
      },
      update: {
        status: 'waiting',
        joinedAt: new Date(),
        leftAt: null,
        removedAt: null,
      },
      include: { event: true, user: true, offers: true },
    });

    const position = await computeQueuePosition(eventId, entry.id);

    await waitlistNotificationService.sendJoinedConfirmation({
      user: entry.user,
      event: entry.event,
      position,
    });

    return {
      entry_id: entry.id,
      event_id: eventId,
      event_title: entry.event.title,
      position,
      message: `You are on the waiting list for ${entry.event.title}. We will notify you immediately if a slot opens up.`,
    };
  },

  async leave(eventId: string, userId: string) {
    const entry = await getUserWaitlistEntry(eventId, userId);
    if (!entry || entry.status !== 'waiting') {
      throw new AppError(404, 'WAITLIST_ENTRY_NOT_FOUND', 'You are not on the waiting list');
    }

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'left', leftAt: new Date() },
    });

    return {
      removed: true,
      event_id: eventId,
      message: 'You have left the waiting list.',
    };
  },

  async getPosition(eventId: string, userId: string) {
    const entry = await getUserWaitlistEntry(eventId, userId);
    if (!entry || ['left', 'expired_removed', 'claimed'].includes(entry.status)) {
      throw new AppError(404, 'WAITLIST_ENTRY_NOT_FOUND', 'You are not on the waiting list');
    }

    const settings = await invitationSettingsService.getInvitationSettings(eventId);
    const activeOffer = await getActiveOfferForEntry(entry as WaitlistEntryWithRelations);
    const position =
      entry.status === 'waiting' ? await computeQueuePosition(eventId, entry.id) : null;

    return {
      event_id: eventId,
      entry_id: entry.id,
      status: entry.status,
      position,
      queue_total: await prisma.waitlistEntry.count({
        where: { eventId, status: 'waiting' },
      }),
      offer_hours: settings.waitlistOfferHours,
      ...(activeOffer
        ? {
            offer_id: activeOffer.id,
            offer_expires_at: activeOffer.expiresAt.toISOString(),
            ...formatCountdown(activeOffer.expiresAt),
          }
        : {}),
    };
  },

  async claimOffer(offerId: string, userId: string, _userPhone: string) {
    const offer = await prisma.waitlistOffer.findFirst({
      where: { id: offerId, userId, status: 'active' },
      include: {
        event: { include: { invitationSettings: true, ticketOfferings: true } },
        waitlistEntry: true,
      },
    });

    if (!offer) {
      throw new AppError(404, 'WAITLIST_OFFER_NOT_FOUND', 'Slot offer not found');
    }

    if (offer.expiresAt <= new Date()) {
      throw new AppError(409, 'WAITLIST_OFFER_EXPIRED', 'This slot offer has expired');
    }

    if (!offer.freedSlotId) {
      throw new AppError(409, 'WAITLIST_OFFER_INVALID', 'Slot offer is no longer valid');
    }

    const slot = await prisma.freedInvitationSlot.findFirst({
      where: { id: offer.freedSlotId, reinvitedAt: null },
    });
    if (!slot) {
      throw new AppError(409, 'WAITLIST_OFFER_INVALID', 'This slot has already been claimed');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const created = await producerInvitationsService.createInvitation(offer.producerId, {
      event_id: offer.eventId,
      type: 'guaranteed',
      recipient_phone: user.phone,
      slot_label: offer.slotLabel,
      cancellation_deadline_days:
        offer.event.invitationSettings?.guaranteedCancellationDays ?? 3,
      personalised_message: 'Courtesy slot from waiting list',
    });

    await prisma.$transaction(async (tx) => {
      await tx.waitlistOffer.update({
        where: { id: offer.id },
        data: {
          status: 'claimed',
          claimedAt: new Date(),
          invitationId: created.id,
        },
      });
      await tx.waitlistEntry.update({
        where: { id: offer.waitlistEntryId },
        data: { status: 'claimed', removedAt: new Date() },
      });
    });

    await markFreedSlotReinvited(slot.id);

    const { expiryDays } = await invitationConfigService.getConfig();
    const invitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: created.id },
      include: { event: true, producer: true, ticket: true, inviter: true, recipient: true },
    });

    return {
      offer_id: offer.id,
      invitation: formatInvitationListItem(invitation, expiryDays),
      message: 'Slot reserved. Complete Guaranteed Pass acceptance to confirm.',
    };
  },

  async listUserWaitlistEntries(userId: string) {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        userId,
        status: { in: ['waiting', 'offered'] },
      },
      include: { event: true, user: true, offers: true },
      orderBy: { joinedAt: 'desc' },
    });

    const formatted = [];
    for (const entry of entries) {
      const settings = await invitationSettingsService.getInvitationSettings(entry.eventId);
      const activeOffer = await getActiveOfferForEntry(entry);
      const position =
        entry.status === 'waiting'
          ? await computeQueuePosition(entry.eventId, entry.id)
          : 0;
      formatted.push(
        formatWaitlistEntryCard(entry, position, activeOffer, settings.waitlistOfferHours),
      );
    }

    return formatted;
  },

  async getProducerWaitlistDashboard(_producerId: string, eventId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { invitationSettings: true },
    });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const entries = await prisma.waitlistEntry.findMany({
      where: {
        eventId,
        status: { in: ['waiting', 'offered'] },
      },
      include: { user: true, offers: { where: { status: 'active' } } },
      orderBy: { joinedAt: 'asc' },
    });

    const offers = await prisma.waitlistOffer.findMany({
      where: { eventId },
      orderBy: { offeredAt: 'desc' },
      take: 100,
    });

    const offerUserIds = [...new Set(offers.map((offer) => offer.userId))];
    const offerUsers = await prisma.user.findMany({
      where: { id: { in: offerUserIds } },
      select: { id: true, fullName: true, phone: true },
    });
    const userById = new Map(offerUsers.map((user) => [user.id, user]));

    const activeOffer = offers.find((offer) => offer.status === 'active') ?? null;
    const settings = event.invitationSettings ?? {
      waitlistOfferHours: INVITATION_SETTINGS_DEFAULTS.waitlistOfferHours,
      enableWaitingList: INVITATION_SETTINGS_DEFAULTS.enableWaitingList,
      enableManualReinvitation: INVITATION_SETTINGS_DEFAULTS.enableManualReinvitation,
      courtesySlotsTotal: INVITATION_SETTINGS_DEFAULTS.courtesySlotsTotal,
      allowGuaranteed: INVITATION_SETTINGS_DEFAULTS.allowGuaranteed,
    };

    const slotsFull = await isCourtesySlotsFull(eventId);

    return {
      event_id: eventId,
      event_title: event.title,
      event_starts_at: event.startsAt.toISOString(),
      settings: {
        enable_waiting_list: settings.enableWaitingList,
        enable_manual_reinvitation: settings.enableManualReinvitation,
        waitlist_offer_hours: settings.waitlistOfferHours,
        courtesy_slots_total: settings.courtesySlotsTotal,
        courtesy_slots_full: slotsFull,
      },
      total_waiting: entries.filter((entry) => entry.status === 'waiting').length,
      offer_hours: settings.waitlistOfferHours,
      active_offer: activeOffer
        ? {
            offer_id: activeOffer.id,
            guest_name: userById.get(activeOffer.userId)?.fullName ?? null,
            guest_phone: userById.get(activeOffer.userId)?.phone ?? null,
            expires_at: activeOffer.expiresAt.toISOString(),
            ...formatCountdown(activeOffer.expiresAt),
          }
        : null,
      queue: entries.map((entry, index) => ({
        position: index + 1,
        entry_id: entry.id,
        guest_name: entry.user.fullName,
        guest_phone: entry.user.phone,
        status: entry.status,
        joined_at: entry.joinedAt.toISOString(),
      })),
      offer_history: offers.map((offer) => ({
        offer_id: offer.id,
        guest_name: userById.get(offer.userId)?.fullName ?? null,
        guest_phone: userById.get(offer.userId)?.phone ?? null,
        status: offer.status,
        offered_at: offer.offeredAt.toISOString(),
        expires_at: offer.expiresAt.toISOString(),
        claimed_at: offer.claimedAt?.toISOString() ?? null,
        expired_at: offer.expiredAt?.toISOString() ?? null,
      })),
    };
  },

  formatUserWaitlistStatus,
  isCourtesySlotsFull,
  onSlotReleased,
  processExpiredOffers,
  processOfferReminders,

  async getWaitlistListingMetaForUser(eventIds: string[], userId: string) {
    if (eventIds.length === 0) {
      return new Map<string, Awaited<ReturnType<typeof formatUserWaitlistStatus>>>();
    }

    const entries = await prisma.waitlistEntry.findMany({
      where: {
        userId,
        eventId: { in: eventIds },
        status: { in: ['waiting', 'offered'] },
      },
      include: { offers: { where: { status: 'active' } } },
    });
    const entryByEvent = new Map(entries.map((entry) => [entry.eventId, entry]));

    const metaByEvent = new Map<string, Awaited<ReturnType<typeof formatUserWaitlistStatus>>>();

    await Promise.all(
      eventIds.map(async (eventId) => {
        const entry = entryByEvent.get(eventId);
        if (entry) {
          const settings = await invitationSettingsService.getInvitationSettings(eventId);
          const activeOffer =
            entry.offers.find(
              (offer) => offer.status === 'active' && offer.expiresAt > new Date(),
            ) ?? null;
          const position =
            entry.status === 'waiting'
              ? await computeQueuePosition(eventId, entry.id)
              : null;
          const joinable = await isCourtesySlotsFull(eventId);

          metaByEvent.set(eventId, {
            enabled: settings.enableWaitingList && settings.allowGuaranteed,
            joinable,
            status: entry.status,
            position,
            offer_id: activeOffer?.id ?? null,
            offer_expires_at: activeOffer?.expiresAt.toISOString() ?? null,
            can_join: false,
            can_leave: entry.status === 'waiting',
            offer_hours: settings.waitlistOfferHours,
            ...(activeOffer ? formatCountdown(activeOffer.expiresAt) : {}),
          });
          return;
        }

        metaByEvent.set(eventId, await formatUserWaitlistStatus(eventId, userId));
      }),
    );

    return metaByEvent;
  },
};
