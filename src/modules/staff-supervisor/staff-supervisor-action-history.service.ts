import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatTimeLabel } from './staff-supervisor-entry-search.service.js';
import type { StaffSupervisorActionHistoryQuery } from './staff-supervisor.validators.js';

function activeEventWindow() {
  const now = Date.now();
  return {
    startsAt: {
      gte: new Date(now - 24 * 60 * 60 * 1000),
      lte: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
  };
}

async function resolveEvent(eventId?: string) {
  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, countryCode: true },
    });

    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    return event;
  }

  const events = await prisma.event.findMany({
    where: activeEventWindow(),
    select: { id: true, title: true, countryCode: true, startsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 20,
  });

  if (events.length === 0) {
    throw new AppError(404, 'ACTIVE_EVENT_NOT_FOUND', 'No active event found for access history');
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const scanCounts = await Promise.all(
    events.map(async (event) => {
      const entryIds = (
        await prisma.invitationTicket.findMany({
          where: { invitation: { eventId: event.id } },
          select: { manualEntryId: true },
          take: 500,
        })
      ).map((row) => row.manualEntryId);

      const count =
        entryIds.length === 0
          ? 0
          : await prisma.staffScanLog.count({
              where: {
                scanType: 'entry',
                entryId: { in: entryIds },
                scannedAt: { gte: since },
              },
            });
      return { event, count };
    }),
  );

  scanCounts.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const now = Date.now();
    const leftDistance = Math.abs(left.event.startsAt.getTime() - now);
    const rightDistance = Math.abs(right.event.startsAt.getTime() - now);
    return leftDistance - rightDistance;
  });

  const selected = scanCounts[0]?.event ?? events[0];
  return {
    id: selected.id,
    title: selected.title,
    countryCode: selected.countryCode,
  };
}

function mapAccessResult(outcome: string, itemName: string): {
  result: 'VALID' | 'RE_ENTRY' | 'REJECTED' | 'SUPERVISOR';
  kind: string;
  category: 'access' | 'entry_override' | 'manual_validation' | 'system';
} {
  const normalizedItem = itemName.toLowerCase();

  if (outcome === 'supervisor_resolved') {
    if (normalizedItem.includes('authorize_reentry') || normalizedItem.includes('re-entry') || normalizedItem.includes('reentry')) {
      return { result: 'RE_ENTRY', kind: 'authorize_reentry', category: 'entry_override' };
    }
    if (normalizedItem.includes('manual') || normalizedItem.includes('authorize_entry')) {
      return { result: 'SUPERVISOR', kind: 'authorize_entry', category: 'manual_validation' };
    }
    return { result: 'SUPERVISOR', kind: 'supervisor_override', category: 'entry_override' };
  }

  if (outcome === 'already_used') {
    return { result: 'REJECTED', kind: 'already_used', category: 'access' };
  }

  if (
    normalizedItem.includes('re-entry') ||
    normalizedItem.includes('reentry') ||
    normalizedItem === 're-entry'
  ) {
    return { result: 'RE_ENTRY', kind: 're_entry', category: 'access' };
  }

  return { result: 'VALID', kind: 'valid', category: 'access' };
}

export const staffSupervisorActionHistoryService = {
  /**
   * Event-wide Access History: recent entry scans + supervisor overrides.
   * Spec: time, code, customer, ticket type, result, access point, staff.
   */
  async getActionHistory(query: StaffSupervisorActionHistoryQuery) {
    const event = await resolveEvent(query.event_id);
    const limit = query.limit ?? 50;

    const tickets = await prisma.invitationTicket.findMany({
      where: { invitation: { eventId: event.id } },
      select: {
        id: true,
        manualEntryId: true,
        invitation: {
          select: {
            assignedSlot: true,
            tier: true,
            recipientName: true,
            recipient: { select: { fullName: true } },
          },
        },
      },
    });

    const entryIds = tickets.map((ticket) => ticket.manualEntryId);
    const ticketByEntryId = new Map(tickets.map((ticket) => [ticket.manualEntryId, ticket]));

    if (entryIds.length === 0) {
      return {
        event_id: event.id,
        event_title: event.title,
        actions: [],
        total: 0,
      };
    }

    const logs = await prisma.staffScanLog.findMany({
      where: {
        scanType: 'entry',
        entryId: { in: entryIds },
      },
      orderBy: { scannedAt: 'desc' },
      take: limit,
      include: {
        staffMember: {
          select: {
            id: true,
            name: true,
            permissionIds: true,
            zone: { select: { label: true } },
          },
        },
      },
    });

    const actions = logs.map((log) => {
      const ticket = log.entryId ? ticketByEntryId.get(log.entryId) : null;
      const guestName =
        log.guestName?.trim() ||
        ticket?.invitation.recipient?.fullName?.trim() ||
        ticket?.invitation.recipientName?.trim() ||
        null;
      const mapped = mapAccessResult(log.outcome, log.itemName);
      const ticketType =
        log.itemName &&
        !log.itemName.toLowerCase().includes('supervisor') &&
        log.itemName.toLowerCase() !== 're-entry' &&
        log.itemName.toLowerCase() !== 'scan'
          ? log.itemName
          : ticket?.invitation.assignedSlot?.trim() ||
            (ticket?.invitation.tier === 'vip' ? 'VIP' : 'General');
      const accessPoint = log.staffMember.zone?.label ?? null;
      const isSupervisorStaff = log.staffMember.permissionIds.some((permissionId) =>
        ['tickets_supervisor', 'general_admin'].includes(permissionId),
      );

      return {
        id: log.id,
        category: mapped.category,
        kind: mapped.kind,
        result: mapped.result,
        supervisor_name: log.staffMember.name,
        staff_name: log.staffMember.name,
        time_label: formatTimeLabel(log.scannedAt, event.countryCode),
        occurred_at: log.scannedAt.toISOString(),
        target_label: guestName,
        guest_name: guestName,
        ticket_type: ticketType,
        access_point: accessPoint,
        device_label: null,
        notes: mapped.result === 'SUPERVISOR' || mapped.result === 'RE_ENTRY' ? log.itemName : null,
        ticket_id: ticket?.id ?? null,
        entry_code: log.entryId,
        is_supervisor: isSupervisorStaff || log.outcome === 'supervisor_resolved',
      };
    });

    return {
      event_id: event.id,
      event_title: event.title,
      actions,
      total: actions.length,
    };
  },
};
