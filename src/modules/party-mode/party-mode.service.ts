import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { haversineDistanceKm } from '../../common/utils/geo-distance.js';
import {
  PARTY_MODE_GEOFENCE_RADIUS_KM,
  PARTY_MODE_POST_EVENT_HOURS,
  PARTY_MODE_PRE_EVENT_HOURS,
} from './party-mode.constants.js';

export type PartyModeRequirements = {
  has_purchased_ticket: boolean;
  ticket_scanned: boolean;
  at_event_location: boolean;
};

export type PartyModeState = {
  enabled: boolean;
  banner_visible: boolean;
  event_id: string | null;
  event_title: string | null;
  distance_km: number | null;
  requirements: PartyModeRequirements;
};

const DISABLED_STATE: PartyModeRequirements = {
  has_purchased_ticket: false,
  ticket_scanned: false,
  at_event_location: false,
};

function isEventLiveForPartyMode(
  event: { startsAt: Date; endsAt: Date | null },
  now: Date,
): boolean {
  const windowStart = new Date(
    event.startsAt.getTime() - PARTY_MODE_PRE_EVENT_HOURS * 60 * 60 * 1000,
  );
  const eventEnd =
    event.endsAt ?? new Date(event.startsAt.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(
    eventEnd.getTime() + PARTY_MODE_POST_EVENT_HOURS * 60 * 60 * 1000,
  );

  return now >= windowStart && now <= windowEnd;
}

function buildDisabledState(
  requirements: PartyModeRequirements = DISABLED_STATE,
): PartyModeState {
  return {
    enabled: false,
    banner_visible: false,
    event_id: null,
    event_title: null,
    distance_km: null,
    requirements,
  };
}

async function loadPurchasedInvitationIds(userId: string): Promise<Set<string>> {
  const invitations = await prisma.invitation.findMany({
    where: { recipientUserId: userId },
    select: { id: true },
  });

  if (invitations.length === 0) {
    return new Set();
  }

  const paidSlots = await prisma.ticketSlot.findMany({
    where: {
      invitationId: { in: invitations.map((row) => row.id) },
      order: { status: 'paid' },
    },
    select: { invitationId: true },
  });

  return new Set(
    paidSlots.map((slot) => slot.invitationId).filter((id): id is string => id != null),
  );
}

function isPartyModeLocationBypassUser(userId: string): boolean {
  return env.PARTY_MODE_BYPASS_USER_IDS.includes(userId);
}

function buildEnabledState(
  eventId: string,
  eventTitle: string,
  distanceKm: number | null,
): PartyModeState {
  return {
    enabled: true,
    banner_visible: true,
    event_id: eventId,
    event_title: eventTitle,
    distance_km: distanceKm,
    requirements: {
      has_purchased_ticket: true,
      ticket_scanned: true,
      at_event_location: true,
    },
  };
}

export const partyModeService = {
  async resolveForUser(
    userId: string | undefined,
    coords?: { lat?: number; lng?: number },
  ): Promise<PartyModeState> {
    if (!userId) {
      return buildDisabledState();
    }

    const purchasedInvitationIds = await loadPurchasedInvitationIds(userId);
    if (purchasedInvitationIds.size === 0) {
      return buildDisabledState();
    }

    const now = new Date();
    const purchasedRows = await prisma.invitation.findMany({
      where: {
        id: { in: [...purchasedInvitationIds] },
        recipientUserId: userId,
      },
      include: {
        event: true,
        ticket: true,
      },
    });

    const scannedRows = purchasedRows.filter(
      (row) => row.status === 'validated' && row.ticket?.validatedAt != null,
    );

    if (scannedRows.length === 0) {
      return buildDisabledState({
        has_purchased_ticket: true,
        ticket_scanned: false,
        at_event_location: false,
      });
    }

    if (isPartyModeLocationBypassUser(userId)) {
      const liveRow =
        scannedRows.find((row) => isEventLiveForPartyMode(row.event, now)) ?? scannedRows[0];

      return buildEnabledState(liveRow.event.id, liveRow.event.title, null);
    }

    const lat = coords?.lat;
    const lng = coords?.lng;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return buildDisabledState({
        has_purchased_ticket: true,
        ticket_scanned: true,
        at_event_location: false,
      });
    }

    let closestMatch: {
      eventId: string;
      eventTitle: string;
      distanceKm: number;
    } | null = null;

    for (const row of scannedRows) {
      const event = row.event;
      if (event.latitude == null || event.longitude == null) {
        continue;
      }
      if (!isEventLiveForPartyMode(event, now)) {
        continue;
      }

      const distanceKm = haversineDistanceKm(
        lat,
        lng,
        event.latitude,
        event.longitude,
      );

      if (distanceKm > PARTY_MODE_GEOFENCE_RADIUS_KM) {
        continue;
      }

      if (!closestMatch || distanceKm < closestMatch.distanceKm) {
        closestMatch = {
          eventId: event.id,
          eventTitle: event.title,
          distanceKm,
        };
      }
    }

    if (!closestMatch) {
      return buildDisabledState({
        has_purchased_ticket: true,
        ticket_scanned: true,
        at_event_location: false,
      });
    }

    return buildEnabledState(
      closestMatch.eventId,
      closestMatch.eventTitle,
      Math.round(closestMatch.distanceKm * 1000) / 1000,
    );
  },
};
