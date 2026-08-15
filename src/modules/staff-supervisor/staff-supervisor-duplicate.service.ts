import type { InvitationAuditLog } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { verifyOtp } from '../../common/utils/crypto.js';
import { hasSupervisorAccess } from '../staff/staff-permissions.constants.js';
import { invitationAuditService } from '../invitations/invitation-audit.service.js';
import { findInvitationTicketByScanInput } from '../invitations/invitation-ticket-scan.utils.js';
import {
  buildVipTags,
  formatPurchaseId,
  formatTimeLabel,
  ticketSearchInclude,
  type TicketWithInvitation,
} from './staff-supervisor-entry-search.service.js';
import type { StaffSupervisorResolveDuplicateInput } from './staff-supervisor.validators.js';

type ScanLogWithStaff = Awaited<
  ReturnType<typeof loadEntryScanLogs>
>[number];

const DUPLICATE_RESOLUTION_ACTION_PREFIX = 'supervisor_duplicate_';

function formatValidatorDetail(staffMember: {
  name: string;
  zone: { label: string; slug: string };
}) {
  const zoneCode = staffMember.zone.label
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '');

  if (zoneCode.length >= 3) {
    return zoneCode;
  }

  return staffMember.name;
}

function formatDeviceLabel(staffMember: ScanLogWithStaff['staffMember']) {
  const zoneLabel = staffMember.zone.label.trim();
  if (zoneLabel.length > 0) {
    return zoneLabel;
  }

  return staffMember.name;
}

function formatResolutionActionLabel(action: string) {
  return action.replace(DUPLICATE_RESOLUTION_ACTION_PREFIX, '').replace(/_/g, ' ');
}

async function loadTicket(ticketId: string) {
  const ticket = await prisma.invitationTicket.findFirst({
    where: { id: ticketId },
    include: ticketSearchInclude,
  });

  if (!ticket) {
    throw new AppError(404, 'ENTRY_NOT_FOUND', 'Entry not found');
  }

  return ticket as TicketWithInvitation;
}

async function loadTicketByEntryCode(entryCode: string) {
  const ticket = await findInvitationTicketByScanInput(entryCode.trim());

  if (!ticket) {
    throw new AppError(404, 'ENTRY_NOT_FOUND', 'Entry not found');
  }

  const fullTicket = await prisma.invitationTicket.findFirst({
    where: { id: ticket.id },
    include: ticketSearchInclude,
  });

  if (!fullTicket) {
    throw new AppError(404, 'ENTRY_NOT_FOUND', 'Entry not found');
  }

  return fullTicket as TicketWithInvitation;
}

async function loadEntryScanLogs(manualEntryId: string) {
  return prisma.staffScanLog.findMany({
    where: {
      entryId: manualEntryId,
      scanType: 'entry',
    },
    orderBy: { scannedAt: 'asc' },
    include: {
      staffMember: {
        include: { zone: true },
      },
    },
  });
}

async function resolveOrderContext(invitationId: string) {
  const slot = await prisma.ticketSlot.findFirst({
    where: { invitationId },
    include: { order: true },
  });

  return slot?.order ?? null;
}

function formatTicketTypeLabel(
  invitation: TicketWithInvitation['invitation'],
  vipTags: string[],
) {
  if (vipTags.length >= 2) {
    return vipTags.join(' · ');
  }

  if (invitation.assignedSlot.trim()) {
    return invitation.assignedSlot;
  }

  return invitation.tier === 'vip' ? 'VIP' : 'General';
}

function formatAccessLabel(log: ScanLogWithStaff | null, tier: string) {
  if (log?.accessLevel?.trim()) {
    return log.accessLevel;
  }

  return tier === 'vip' ? 'VIP 1' : 'General';
}

async function findLatestDuplicateResolution(
  invitationId: string,
  duplicateAttemptAt: Date,
) {
  return prisma.invitationAuditLog.findFirst({
    where: {
      invitationId,
      action: { startsWith: DUPLICATE_RESOLUTION_ACTION_PREFIX },
      result: 'success',
      createdAt: { gte: duplicateAttemptAt },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function formatQrHistory(
  scanLogs: ScanLogWithStaff[],
  countryCode: string,
  options: {
    isPending: boolean;
    resolution: InvitationAuditLog | null;
  },
) {
  type QrHistoryEvent = {
    kind: 'validated' | 'reentry_rejected' | 'supervisor_pending' | 'supervisor_resolved';
    time_label: string;
    detail: string;
  };

  const events: QrHistoryEvent[] = scanLogs.map((log) => {
    if (log.outcome === 'valid') {
      return {
        kind: 'validated' as const,
        time_label: formatTimeLabel(log.scannedAt, countryCode),
        detail: formatValidatorDetail(log.staffMember),
      };
    }

    return {
      kind: 'reentry_rejected' as const,
      time_label: formatTimeLabel(log.scannedAt, countryCode),
      detail: formatDeviceLabel(log.staffMember),
    };
  });

  if (options.isPending) {
    events.push({
      kind: 'supervisor_pending' as const,
      time_label: '--',
      detail: 'Pending',
    });
  } else if (options.resolution) {
    events.push({
      kind: 'supervisor_resolved' as const,
      time_label: formatTimeLabel(options.resolution.createdAt, countryCode),
      detail: formatResolutionActionLabel(options.resolution.action),
    });
  }

  return events;
}

async function assertSupervisorPin(staffMemberId: string, pin: string) {
  const member = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    select: {
      permissionIds: true,
      supervisorPinHash: true,
    },
  });

  if (!member) {
    throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found');
  }

  if (!hasSupervisorAccess(member.permissionIds)) {
    throw new AppError(
      403,
      'SUPERVISOR_ACCESS_DENIED',
      'This staff account is not authorized for supervisor mode',
    );
  }

  if (!member.supervisorPinHash) {
    throw new AppError(
      403,
      'SUPERVISOR_PIN_NOT_CONFIGURED',
      'Supervisor PIN has not been configured by an administrator',
    );
  }

  const isValid = await verifyOtp(pin, member.supervisorPinHash);

  if (!isValid) {
    throw new AppError(401, 'SUPERVISOR_PIN_INVALID', 'Incorrect supervisor PIN');
  }
}

async function logSupervisorDuplicateScan(
  staffMemberId: string,
  ticket: TicketWithInvitation,
  action: StaffSupervisorResolveDuplicateInput['action'],
) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';

  await prisma.staffScanLog.create({
    data: {
      staffMemberId,
      scanType: 'entry',
      outcome: 'supervisor_resolved',
      guestName,
      itemName: formatResolutionActionLabel(`${DUPLICATE_RESOLUTION_ACTION_PREFIX}${action}`),
      eventTitle: invitation.event.title,
      entryId: ticket.manualEntryId,
      transactionId: ticket.manualEntryId,
      qrPayload: ticket.qrPayload,
      accessLevel: invitation.tier === 'vip' ? 'VIP 1' : 'General',
    },
  });
}

export async function formatDuplicateAlertResponse(ticket: TicketWithInvitation) {
  if (!ticket.validatedAt) {
    throw new AppError(
      409,
      'DUPLICATE_NOT_FOUND',
      'This entry has not been validated yet',
    );
  }

  const scanLogs = await loadEntryScanLogs(ticket.manualEntryId);
  const validLog = scanLogs.find((log) => log.outcome === 'valid') ?? null;
  const latestDuplicateLog = [...scanLogs]
    .reverse()
    .find((log) => log.outcome === 'already_used');

  if (!latestDuplicateLog) {
    throw new AppError(
      409,
      'DUPLICATE_NOT_FOUND',
      'No duplicate scan attempts were found for this entry',
    );
  }

  const invitation = ticket.invitation;
  const countryCode = invitation.event.countryCode;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';
  const order = await resolveOrderContext(invitation.id);
  const vipTags = buildVipTags(invitation);
  const purchaseId =
    formatPurchaseId(order) ?? `INV-${invitation.id.slice(-6).toUpperCase()}`;
  const resolution = await findLatestDuplicateResolution(
    invitation.id,
    latestDuplicateLog.scannedAt,
  );
  const isPending = !resolution;

  return {
    ticket_id: ticket.id,
    invitation_id: invitation.id,
    guest_name: guestName,
    event_name: invitation.event.title,
    ticket_type_label: formatTicketTypeLabel(invitation, vipTags),
    qr_id: ticket.manualEntryId,
    purchase_id: purchaseId,
    is_vip: invitation.tier === 'vip',
    is_pending: isPending,
    status: isPending ? ('pending' as const) : ('resolved' as const),
    last_valid_access: {
      time_label: formatTimeLabel(validLog?.scannedAt ?? ticket.validatedAt, countryCode),
      access_label: formatAccessLabel(validLog, invitation.tier),
      device_label: validLog
        ? formatValidatorDetail(validLog.staffMember)
        : 'Unknown',
    },
    new_attempt: {
      time_label: formatTimeLabel(latestDuplicateLog.scannedAt, countryCode),
      access_label: formatAccessLabel(latestDuplicateLog, invitation.tier),
      device_label: formatDeviceLabel(latestDuplicateLog.staffMember),
    },
    qr_history: formatQrHistory(scanLogs, countryCode, {
      isPending,
      resolution,
    }),
    last_resolution: resolution
      ? {
          action: formatResolutionActionLabel(resolution.action),
          resolved_at: resolution.createdAt.toISOString(),
        }
      : null,
  };
}

async function applyDuplicateResolution(
  ticket: TicketWithInvitation,
  staffMemberId: string,
  input: StaffSupervisorResolveDuplicateInput,
) {
  await assertSupervisorPin(staffMemberId, input.pin);

  const invitation = ticket.invitation;
  const scanLogs = await loadEntryScanLogs(ticket.manualEntryId);
  const latestDuplicateLog = [...scanLogs]
    .reverse()
    .find((log) => log.outcome === 'already_used');

  if (!latestDuplicateLog) {
    throw new AppError(
      409,
      'DUPLICATE_NOT_FOUND',
      'No duplicate scan attempts were found for this entry',
    );
  }

  const existingResolution = await findLatestDuplicateResolution(
    invitation.id,
    latestDuplicateLog.scannedAt,
  );

  if (existingResolution) {
    throw new AppError(
      409,
      'DUPLICATE_ALREADY_RESOLVED',
      'This duplicate alert has already been resolved',
    );
  }

  const now = new Date();

  switch (input.action) {
    case 'revalidate_qr':
      await prisma.$transaction(async (tx) => {
        await tx.invitationTicket.update({
          where: { id: ticket.id },
          data: { validatedAt: now },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'validated' },
        });
      });
      break;
    case 'release_reentry':
      await prisma.$transaction(async (tx) => {
        await tx.invitationTicket.update({
          where: { id: ticket.id },
          data: { validatedAt: null },
        });
        if (invitation.status === 'validated') {
          await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'accepted' },
          });
        }
      });
      break;
    case 'block_qr':
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'rejected',
          respondedAt: now,
        },
      });
      break;
    case 'escalate_alert':
      break;
    default:
      throw new AppError(400, 'INVALID_DUPLICATE_ACTION', 'Unsupported duplicate action');
  }

  await invitationAuditService.log({
    invitationId: invitation.id,
    actorType: 'system',
    action: `${DUPLICATE_RESOLUTION_ACTION_PREFIX}${input.action}`,
    result: 'success',
    metadata: {
      staff_member_id: staffMemberId,
      ticket_id: ticket.id,
      duplicate_reason: input.reason,
      notes: input.notes.trim(),
    },
  });

  await logSupervisorDuplicateScan(staffMemberId, ticket, input.action);

  return {
    resolved: true,
    action: input.action,
    ticket_id: ticket.id,
    entry_code: ticket.manualEntryId,
  };
}

export const staffSupervisorDuplicateService = {
  async getDuplicateAlert(ticketId: string) {
    const ticket = await loadTicket(ticketId);
    return formatDuplicateAlertResponse(ticket);
  },

  async getDuplicateAlertByEntryCode(entryCode: string) {
    const ticket = await loadTicketByEntryCode(entryCode);
    return formatDuplicateAlertResponse(ticket);
  },

  async resolveDuplicate(
    ticketId: string,
    staffMemberId: string,
    input: StaffSupervisorResolveDuplicateInput,
  ) {
    const ticket = await loadTicket(ticketId);
    return applyDuplicateResolution(ticket, staffMemberId, input);
  },

  async resolveDuplicateByEntryCode(
    entryCode: string,
    staffMemberId: string,
    input: StaffSupervisorResolveDuplicateInput,
  ) {
    const ticket = await loadTicketByEntryCode(entryCode);
    return applyDuplicateResolution(ticket, staffMemberId, input);
  },
};
