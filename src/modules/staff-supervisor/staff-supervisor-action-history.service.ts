import type { InvitationAuditLog } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatTimeLabel } from './staff-supervisor-entry-search.service.js';
import type { StaffSupervisorActionHistoryQuery } from './staff-supervisor.validators.js';

const SUPERVISOR_ACTION_PREFIX = 'supervisor_';
const ACTION_PREFIXES = [
  ['supervisor_system_', 'system'],
  ['supervisor_vip_', 'vip'],
  ['supervisor_entry_manual_validation_', 'manual_validation'],
  ['supervisor_duplicate_', 'duplicate'],
  ['supervisor_entry_override_', 'entry_override'],
] as const;

type ActionCategory = (typeof ACTION_PREFIXES)[number][1];

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
    throw new AppError(404, 'ACTIVE_EVENT_NOT_FOUND', 'No active event found for action history');
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const validationCounts = await Promise.all(
    events.map(async (event) => {
      const count = await prisma.invitationTicket.count({
        where: {
          validatedAt: { gte: since },
          invitation: { eventId: event.id },
        },
      });
      return { event, count };
    }),
  );

  validationCounts.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const now = Date.now();
    const leftDistance = Math.abs(left.event.startsAt.getTime() - now);
    const rightDistance = Math.abs(right.event.startsAt.getTime() - now);
    return leftDistance - rightDistance;
  });

  const selected = validationCounts[0]?.event ?? events[0];
  return {
    id: selected.id,
    title: selected.title,
    countryCode: selected.countryCode,
  };
}

function parseSupervisorAction(action: string): { category: ActionCategory; kind: string } {
  for (const [prefix, category] of ACTION_PREFIXES) {
    if (action.startsWith(prefix)) {
      return { category, kind: action.slice(prefix.length) };
    }
  }

  if (action.startsWith(SUPERVISOR_ACTION_PREFIX)) {
    return { category: 'system', kind: action.slice(SUPERVISOR_ACTION_PREFIX.length) };
  }

  return { category: 'system', kind: action };
}

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveGuestName(
  invitation: NonNullable<
    Awaited<ReturnType<typeof loadAuditLogs>>[number]['invitation']
  > | null,
) {
  if (!invitation) {
    return null;
  }

  return invitation.recipient?.fullName?.trim() || invitation.recipientName?.trim() || null;
}

function resolveTargetLabel(
  category: ActionCategory,
  kind: string,
  metadata: Record<string, unknown>,
  invitation: Awaited<ReturnType<typeof loadAuditLogs>>[number]['invitation'],
) {
  if (category === 'system') {
    if (kind === 'scanner_restarted') {
      return readMetadataString(metadata, 'scanner_id');
    }

    if (kind === 'staff_alert') {
      const message = readMetadataString(metadata, 'message');
      return message ? message.slice(0, 80) : null;
    }

    return null;
  }

  const guestName = readMetadataString(metadata, 'guest_name') ?? resolveGuestName(invitation);
  if (guestName) {
    return guestName;
  }

  if (category === 'vip') {
    return readMetadataString(metadata, 'access_label') ?? invitation?.assignedSlot?.trim() ?? null;
  }

  return invitation?.assignedSlot?.trim() ?? null;
}

async function loadAuditLogs(eventId: string, limit: number) {
  const invitationRows = await prisma.invitation.findMany({
    where: { eventId },
    select: { id: true },
  });
  const invitationIds = invitationRows.map((row) => row.id);

  if (invitationIds.length === 0) {
    return prisma.invitationAuditLog.findMany({
      where: {
        action: { startsWith: 'supervisor_system_' },
        result: 'success',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        invitation: {
          select: {
            eventId: true,
            recipientName: true,
            assignedSlot: true,
            recipient: { select: { fullName: true } },
          },
        },
      },
    });
  }

  const rows = await prisma.invitationAuditLog.findMany({
    where: {
      OR: [
        {
          invitationId: { in: invitationIds },
          action: { startsWith: SUPERVISOR_ACTION_PREFIX },
          result: 'success',
        },
        {
          action: { startsWith: 'supervisor_system_' },
          result: 'success',
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit * 3, limit), 150),
    include: {
      invitation: {
        select: {
          eventId: true,
          recipientName: true,
          assignedSlot: true,
          recipient: { select: { fullName: true } },
        },
      },
    },
  });

  return rows
    .filter((row) => {
      if (row.action.startsWith('supervisor_system_')) {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        return metadata.event_id === eventId;
      }

      return row.invitation?.eventId === eventId;
    })
    .slice(0, limit);
}

async function loadStaffNames(rows: InvitationAuditLog[]) {
  const staffIds = rows
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return typeof metadata.staff_member_id === 'string' ? metadata.staff_member_id : null;
    })
    .filter((id): id is string => Boolean(id));

  if (staffIds.length === 0) {
    return new Map<string, string>();
  }

  const staffMembers = await prisma.staffMember.findMany({
    where: { id: { in: [...new Set(staffIds)] } },
    select: { id: true, name: true },
  });

  return new Map(staffMembers.map((member) => [member.id, member.name]));
}

async function loadTicketDetails(rows: InvitationAuditLog[]) {
  const metadataTicketIds = rows
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return typeof metadata.ticket_id === 'string' ? metadata.ticket_id : null;
    })
    .filter((id): id is string => Boolean(id));

  const invitationIds = rows
    .filter((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return !metadata.ticket_id && row.invitationId;
    })
    .map((row) => row.invitationId!)
    .filter((id, index, list) => list.indexOf(id) === index);

  const ticketFilters = [
    ...(metadataTicketIds.length > 0
      ? [{ id: { in: [...new Set(metadataTicketIds)] } }]
      : []),
    ...(invitationIds.length > 0 ? [{ invitationId: { in: invitationIds } }] : []),
  ];

  if (ticketFilters.length === 0) {
    return {
      ticketIdByInvitationId: new Map<string, string>(),
      entryCodeByTicketId: new Map<string, string>(),
    };
  }

  const tickets = await prisma.invitationTicket.findMany({
    where: { OR: ticketFilters },
    select: { id: true, invitationId: true, manualEntryId: true },
  });

  const ticketIdByInvitationId = new Map<string, string>();
  const entryCodeByTicketId = new Map<string, string>();

  for (const ticket of tickets) {
    entryCodeByTicketId.set(ticket.id, ticket.manualEntryId);
    if (ticket.invitationId && !ticketIdByInvitationId.has(ticket.invitationId)) {
      ticketIdByInvitationId.set(ticket.invitationId, ticket.id);
    }
  }

  return { ticketIdByInvitationId, entryCodeByTicketId };
}

function formatActionRow(
  row: Awaited<ReturnType<typeof loadAuditLogs>>[number],
  countryCode: string,
  staffNameById: Map<string, string>,
  ticketIdByInvitationId: Map<string, string>,
  entryCodeByTicketId: Map<string, string>,
) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const { category, kind } = parseSupervisorAction(row.action);
  const staffMemberId = readMetadataString(metadata, 'staff_member_id');
  const ticketId =
    readMetadataString(metadata, 'ticket_id') ??
    (row.invitationId ? ticketIdByInvitationId.get(row.invitationId) ?? null : null);
  const supervisorName =
    readMetadataString(metadata, 'staff_name') ??
    readMetadataString(metadata, 'supervisor_name') ??
    (staffMemberId ? staffNameById.get(staffMemberId) : null) ??
    'Supervisor';

  return {
    id: row.id,
    category,
    kind,
    supervisor_name: supervisorName,
    time_label: formatTimeLabel(row.createdAt, countryCode),
    occurred_at: row.createdAt.toISOString(),
    target_label: resolveTargetLabel(category, kind, metadata, row.invitation),
    notes: readMetadataString(metadata, 'notes'),
    ticket_id: ticketId,
    entry_code: ticketId ? entryCodeByTicketId.get(ticketId) ?? null : null,
  };
}

export const staffSupervisorActionHistoryService = {
  async getActionHistory(query: StaffSupervisorActionHistoryQuery) {
    const event = await resolveEvent(query.event_id);
    const limit = query.limit ?? 50;
    const rows = await loadAuditLogs(event.id, limit);
    const [staffNameById, ticketDetails] = await Promise.all([
      loadStaffNames(rows),
      loadTicketDetails(rows),
    ]);

    const actions = rows.map((row) =>
      formatActionRow(
        row,
        event.countryCode,
        staffNameById,
        ticketDetails.ticketIdByInvitationId,
        ticketDetails.entryCodeByTicketId,
      ),
    );

    return {
      event_id: event.id,
      event_title: event.title,
      actions,
      total: actions.length,
    };
  },
};
