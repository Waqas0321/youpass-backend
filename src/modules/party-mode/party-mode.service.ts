import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { haversineDistanceKm } from '../../common/utils/geo-distance.js';
import { PARTY_MODE_GEOFENCE_RADIUS_KM } from './party-mode.constants.js';
import {
  isEventLiveForPartyMode,
  selectEventByDateTime,
  type PartyModeEventTiming,
} from './party-mode.selection.js';

export type PartyModeRequirements = {
  has_purchased_ticket: boolean;
  ticket_scanned: boolean;
  at_event_location: boolean;
};

export type PartyModeEligibleEvent = {
  event_id: string;
  event_title: string;
  starts_at: string;
  ends_at: string | null;
};

export type PartyModeState = {
  enabled: boolean;
  banner_visible: boolean;
  event_id: string | null;
  event_title: string | null;
  /** Most recent scanned ticket event, even when Party Mode is not yet enabled. */
  scanned_event_id: string | null;
  scanned_event_title: string | null;
  distance_km: number | null;
  /** Events the user can open a drink menu for right now. */
  eligible_events: PartyModeEligibleEvent[];
  requirements: PartyModeRequirements;
};

const DISABLED_STATE: PartyModeRequirements = {
  has_purchased_ticket: false,
  ticket_scanned: false,
  at_event_location: false,
};

function buildDisabledState(
  requirements: PartyModeRequirements = DISABLED_STATE,
  scannedEvent?: { id: string; title: string } | null,
): PartyModeState {
  return {
    enabled: false,
    banner_visible: false,
    event_id: null,
    event_title: null,
    scanned_event_id: scannedEvent?.id ?? null,
    scanned_event_title: scannedEvent?.title ?? null,
    distance_km: null,
    eligible_events: [],
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
  if (env.PARTY_MODE_BYPASS_LOCATION) {
    return true;
  }
  return env.PARTY_MODE_BYPASS_USER_IDS.includes(userId);
}

function toEligibleEvent(event: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
}): PartyModeEligibleEvent {
  return {
    event_id: event.id,
    event_title: event.title,
    starts_at: event.startsAt.toISOString(),
    ends_at: event.endsAt?.toISOString() ?? null,
  };
}

function uniqueEventsById(
  events: Array<{
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
  }>,
): PartyModeEligibleEvent[] {
  const seen = new Set<string>();
  const result: PartyModeEligibleEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    result.push(toEligibleEvent(event));
  }
  return result;
}

function buildEnabledState(input: {
  eventId: string;
  eventTitle: string;
  distanceKm: number | null;
  eligibleEvents: PartyModeEligibleEvent[];
}): PartyModeState {
  return {
    enabled: true,
    banner_visible: true,
    event_id: input.eventId,
    event_title: input.eventTitle,
    scanned_event_id: input.eventId,
    scanned_event_title: input.eventTitle,
    distance_km: input.distanceKm,
    eligible_events: input.eligibleEvents,
    requirements: {
      has_purchased_ticket: true,
      ticket_scanned: true,
      at_event_location: true,
    },
  };
}

function pickPrimaryScannedEvent(
  scannedRows: ScannedInvitationRow[],
  now: Date,
): ScannedInvitationRow | null {
  const liveRows = scannedRows.filter((row) =>
    isEventLiveForPartyMode(row.event, now),
  );
  const pool = liveRows.length > 0 ? liveRows : scannedRows;
  return pickScannedEventBySchedule(pool, now);
}

type ScannedInvitationRow = {
  event: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
    latitude: number | null;
    longitude: number | null;
  };
};

function withRowTiming(row: ScannedInvitationRow): PartyModeEventTiming & {
  row: ScannedInvitationRow;
} {
  return {
    id: row.event.id,
    title: row.event.title,
    startsAt: row.event.startsAt,
    endsAt: row.event.endsAt,
    row,
  };
}

function pickScannedEventBySchedule(
  scannedRows: ScannedInvitationRow[],
  now: Date,
): ScannedInvitationRow | null {
  const selected = selectEventByDateTime(
    scannedRows.map(withRowTiming),
    now,
  );
  return selected?.row ?? null;
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

    const primaryScannedEvent = pickPrimaryScannedEvent(scannedRows, now);
    const scannedEventMeta = primaryScannedEvent
      ? {
          id: primaryScannedEvent.event.id,
          title: primaryScannedEvent.event.title,
        }
      : null;

    if (isPartyModeLocationBypassUser(userId)) {
      const liveRows = scannedRows.filter((row) =>
        isEventLiveForPartyMode(row.event, now),
      );
      const chooserPool = liveRows.length > 0 ? liveRows : scannedRows;
      const selectedRow = pickScannedEventBySchedule(chooserPool, now);
      if (!selectedRow) {
        return buildDisabledState(
          {
            has_purchased_ticket: true,
            ticket_scanned: true,
            at_event_location: false,
          },
          scannedEventMeta,
        );
      }

      const eligibleEvents = uniqueEventsById(
        chooserPool.map((row) => row.event),
      );

      return buildEnabledState({
        eventId: selectedRow.event.id,
        eventTitle: selectedRow.event.title,
        distanceKm: null,
        eligibleEvents,
      });
    }

    const lat = coords?.lat;
    const lng = coords?.lng;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return buildDisabledState(
        {
          has_purchased_ticket: true,
          ticket_scanned: true,
          at_event_location: false,
        },
        scannedEventMeta,
      );
    }

    const geofencedLive: Array<
      ScannedInvitationRow & { distanceKm: number }
    > = [];

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

      geofencedLive.push({ ...row, distanceKm });
    }

    if (geofencedLive.length === 0) {
      return buildDisabledState(
        {
          has_purchased_ticket: true,
          ticket_scanned: true,
          at_event_location: false,
        },
        scannedEventMeta,
      );
    }

    const schedulePick = selectEventByDateTime(
      geofencedLive.map((row) => ({
        id: row.event.id,
        title: row.event.title,
        startsAt: row.event.startsAt,
        endsAt: row.event.endsAt,
        row,
      })),
      now,
    );
    const selected = schedulePick?.row ?? geofencedLive[0];
    const eligibleEvents = uniqueEventsById(
      geofencedLive.map((row) => row.event),
    );

    return buildEnabledState({
      eventId: selected.event.id,
      eventTitle: selected.event.title,
      distanceKm: Math.round(selected.distanceKm * 1000) / 1000,
      eligibleEvents,
    });
  },
};
