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
  resolveEntryStatus,
  ticketSearchInclude,
  type TicketWithInvitation,
} from './staff-supervisor-entry-search.service.js';
import type { StaffSupervisorApplyEntryOverrideInput } from './staff-supervisor.validators.js';

const OVERRIDE_ACTION_PREFIX = 'supervisor_entry_override_';

function formatGuestInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'G';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

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

function formatAccessLabel(invitation: TicketWithInvitation['invitation']) {
  if (invitation.assignedSlot.trim()) {
    return invitation.assignedSlot;
  }

  return invitation.tier === 'vip' ? 'VIP 1' : 'General';
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

function formatActionLabel(action: string) {
  return action.replace(OVERRIDE_ACTION_PREFIX, '').replace(/_/g, ' ');
}

async function buildOverrideLogs(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;
  const countryCode = invitation.event.countryCode;

  const [scanLogs, auditLogs] = await Promise.all([
    prisma.staffScanLog.findMany({
      where: {
        entryId: ticket.manualEntryId,
        scanType: 'entry',
      },
      orderBy: { scannedAt: 'asc' },
      take: 20,
      include: {
        staffMember: {
          include: { zone: true },
        },
      },
    }),
    prisma.invitationAuditLog.findMany({
      where: {
        invitationId: invitation.id,
        action: { startsWith: 'supervisor_' },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
  ]);

  type OverrideLog = {
    kind: 'validated' | 'blocked' | 'supervisor' | 'reentry' | 'pending';
    time_label: string;
    label: string;
  };

  const logs: OverrideLog[] = scanLogs.map((log) => {
    if (log.outcome === 'valid') {
      return {
        kind: 'validated' as const,
        time_label: formatTimeLabel(log.scannedAt, countryCode),
        label: formatValidatorDetail(log.staffMember),
      };
    }

    if (log.outcome === 'supervisor_resolved') {
      return {
        kind: 'supervisor' as const,
        time_label: formatTimeLabel(log.scannedAt, countryCode),
        label: log.itemName,
      };
    }

    return {
      kind: 'reentry' as const,
      time_label: formatTimeLabel(log.scannedAt, countryCode),
      label: formatValidatorDetail(log.staffMember),
    };
  });

  for (const audit of auditLogs) {
    logs.push({
      kind: 'supervisor',
      time_label: formatTimeLabel(audit.createdAt, countryCode),
      label: formatActionLabel(audit.action),
    });
  }

  logs.sort((a, b) => a.time_label.localeCompare(b.time_label));

  return logs.slice(-10);
}

export async function formatEntryOverrideContext(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';
  const countryCode = invitation.event.countryCode;
  const order = await resolveOrderContext(invitation.id);
  const vipTags = buildVipTags(invitation);
  const purchaseId =
    formatPurchaseId(order) ?? `INV-${invitation.id.slice(-6).toUpperCase()}`;
  const isBlocked = invitation.status === 'rejected';
  const entryStatus = resolveEntryStatus(ticket);

  const latestValidScan = await prisma.staffScanLog.findFirst({
    where: {
      entryId: ticket.manualEntryId,
      scanType: 'entry',
      outcome: 'valid',
    },
    orderBy: { scannedAt: 'desc' },
    include: {
      staffMember: {
        include: { zone: true },
      },
    },
  });

  const lastUsedAt = ticket.validatedAt ?? latestValidScan?.scannedAt ?? null;

  return {
    ticket_id: ticket.id,
    invitation_id: invitation.id,
    guest_name: guestName,
    initials: formatGuestInitials(guestName),
    event_name: invitation.event.title,
    ticket_type_label: formatTicketTypeLabel(invitation, vipTags),
    access_label: formatAccessLabel(invitation),
    qr_id: ticket.manualEntryId,
    purchase_id: purchaseId,
    is_blocked: isBlocked,
    is_validated: Boolean(ticket.validatedAt) || invitation.status === 'validated',
    entry_status: isBlocked ? 'blocked' : entryStatus,
    last_used_at_label: lastUsedAt
      ? formatTimeLabel(lastUsedAt, countryCode)
      : '--',
    scanner_id: latestValidScan
      ? formatValidatorDetail(latestValidScan.staffMember)
      : '--',
    logs: await buildOverrideLogs(ticket),
  };
}

async function logSupervisorOverrideScan(
  staffMemberId: string,
  ticket: TicketWithInvitation,
  action: StaffSupervisorApplyEntryOverrideInput['action'],
) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';

  await prisma.staffScanLog.create({
    data: {
      staffMemberId,
      scanType: 'entry',
      outcome: 'supervisor_resolved',
      guestName,
      itemName: formatActionLabel(`${OVERRIDE_ACTION_PREFIX}${action}`),
      eventTitle: invitation.event.title,
      entryId: ticket.manualEntryId,
      transactionId: ticket.manualEntryId,
      qrPayload: ticket.qrPayload,
      accessLevel: invitation.tier === 'vip' ? 'VIP 1' : 'General',
    },
  });
}

async function applyEntryOverride(
  ticket: TicketWithInvitation,
  staffMemberId: string,
  input: StaffSupervisorApplyEntryOverrideInput,
) {
  await assertSupervisorPin(staffMemberId, input.pin);

  const invitation = ticket.invitation;
  const now = new Date();

  switch (input.action) {
    case 'authorize_reentry': {
      // Non-destructive: keep original validatedAt; grant one re-entry via unlockAt.
      if (!ticket.validatedAt) {
        throw new AppError(
          409,
          'TICKET_NOT_USED',
          'Re-entry can only be authorized for a ticket that has already been used',
        );
      }
      await prisma.invitationTicket.update({
        where: { id: ticket.id },
        data: { unlockAt: now },
      });
      break;
    }
    case 'release_qr':
    case 'revert_validation':
    case 'temporary_unlock':
      await prisma.$transaction(async (tx) => {
        await tx.invitationTicket.update({
          where: { id: ticket.id },
          data: { validatedAt: null },
        });
        if (invitation.status === 'validated' || invitation.status === 'rejected') {
          await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'accepted', respondedAt: null },
          });
        }
      });
      break;
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
    default:
      throw new AppError(400, 'INVALID_OVERRIDE_ACTION', 'Unsupported override action');
  }

  await invitationAuditService.log({
    invitationId: invitation.id,
    actorType: 'system',
    action: `${OVERRIDE_ACTION_PREFIX}${input.action}`,
    result: 'success',
    metadata: {
      staff_member_id: staffMemberId,
      ticket_id: ticket.id,
      notes: input.notes.trim(),
      temporary: input.action === 'temporary_unlock',
      previous_validated_at: ticket.validatedAt?.toISOString() ?? null,
      preserves_original_entry: input.action === 'authorize_reentry',
    },
  });

  await logSupervisorOverrideScan(staffMemberId, ticket, input.action);

  return {
    applied: true,
    action: input.action,
    ticket_id: ticket.id,
    entry_code: ticket.manualEntryId,
    context: await formatEntryOverrideContext(
      (await loadTicket(ticket.id)) as TicketWithInvitation,
    ),
  };
}

export const staffSupervisorEntryOverrideService = {
  async getOverrideContext(ticketId: string) {
    const ticket = await loadTicket(ticketId);
    return formatEntryOverrideContext(ticket);
  },

  async getOverrideContextByEntryCode(entryCode: string) {
    const ticket = await loadTicketByEntryCode(entryCode);
    return formatEntryOverrideContext(ticket);
  },

  async applyOverride(
    ticketId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryOverrideInput,
  ) {
    const ticket = await loadTicket(ticketId);
    return applyEntryOverride(ticket, staffMemberId, input);
  },

  async applyOverrideByEntryCode(
    entryCode: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryOverrideInput,
  ) {
    const ticket = await loadTicketByEntryCode(entryCode);
    return applyEntryOverride(ticket, staffMemberId, input);
  },
};
