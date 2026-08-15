import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { verifyOtp } from '../../common/utils/crypto.js';
import { hasSupervisorAccess } from '../staff/staff-permissions.constants.js';
import { invitationAuditService } from '../invitations/invitation-audit.service.js';
import { findInvitationTicketByScanInput } from '../invitations/invitation-ticket-scan.utils.js';
import { requiresNoShowPreauth } from '../invitations/invitation-product-type.utils.js';
import { releaseInvitationPreAuthHold } from '../invitations/invitation-lifecycle.service.js';
import { generateQrPayload } from '../invitations/invitations.utils.js';
import {
  buildVipTags,
  formatTimeLabel,
  resolveEntryStatus,
  ticketSearchInclude,
  type TicketWithInvitation,
} from './staff-supervisor-entry-search.service.js';
import { TEMPORARY_QR_VALIDITY_MINUTES } from './staff-supervisor.constants.js';
import type { StaffSupervisorApplyEntryManualValidationInput } from './staff-supervisor.validators.js';

const MANUAL_VALIDATION_ACTION_PREFIX = 'supervisor_entry_manual_validation_';

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

function formatPhoneLastDigits(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) {
    return digits || '--';
  }

  return digits.slice(-4);
}

function resolveSystemStatus(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;

  if (invitation.status === 'rejected') {
    return 'rejected' as const;
  }

  if (ticket.validatedAt || invitation.status === 'validated') {
    return 'authorized' as const;
  }

  return 'pending' as const;
}

function isQrUnavailable(ticket: TicketWithInvitation) {
  return !ticket.qrPayload.trim();
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

async function resolveLatestManualValidationTime(
  invitationId: string,
  countryCode: string,
) {
  const audit = await prisma.invitationAuditLog.findFirst({
    where: {
      invitationId,
      action: { startsWith: MANUAL_VALIDATION_ACTION_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!audit) {
    return null;
  }

  return formatTimeLabel(audit.createdAt, countryCode);
}

export async function formatEntryManualValidationContext(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';
  const guestPhone = invitation.recipientPhone.trim();
  const countryCode = invitation.event.countryCode;
  const vipTags = buildVipTags(invitation);
  const systemStatus = resolveSystemStatus(ticket);

  return {
    ticket_id: ticket.id,
    invitation_id: invitation.id,
    guest_name: guestName,
    initials: formatGuestInitials(guestName),
    event_name: invitation.event.title,
    ticket_type_label: formatTicketTypeLabel(invitation, vipTags),
    access_label: formatAccessLabel(invitation),
    qr_id: ticket.manualEntryId,
    guest_phone: guestPhone,
    phone_last_digits: formatPhoneLastDigits(guestPhone),
    is_document_confirmed: Boolean(invitation.recipientUserId && invitation.recipient?.fullName),
    is_qr_unavailable: isQrUnavailable(ticket),
    entry_status: resolveEntryStatus(ticket),
    system_status: systemStatus,
    system_record_time_label:
      (await resolveLatestManualValidationTime(invitation.id, countryCode)) ??
      formatTimeLabel(new Date(), countryCode),
    can_authorize:
      systemStatus === 'pending' &&
      (invitation.status === 'accepted' || invitation.status === 'validated'),
  };
}

async function logManualValidationScan(
  staffMemberId: string,
  ticket: TicketWithInvitation,
  action: StaffSupervisorApplyEntryManualValidationInput['action'],
  outcome: 'valid' | 'supervisor_resolved' | 'already_used',
) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';

  await prisma.staffScanLog.create({
    data: {
      staffMemberId,
      scanType: 'entry',
      outcome,
      guestName,
      itemName: `${MANUAL_VALIDATION_ACTION_PREFIX}${action}`,
      eventTitle: invitation.event.title,
      entryId: ticket.manualEntryId,
      transactionId: ticket.manualEntryId,
      qrPayload: ticket.qrPayload,
      accessLevel: invitation.tier === 'vip' ? 'VIP 1' : 'General',
    },
  });
}

async function applyManualValidation(
  ticket: TicketWithInvitation,
  staffMemberId: string,
  input: StaffSupervisorApplyEntryManualValidationInput,
) {
  await assertSupervisorPin(staffMemberId, input.pin);

  const invitation = ticket.invitation;
  const now = new Date();

  if (invitation.status !== 'accepted' && invitation.status !== 'validated') {
    throw new AppError(409, 'ENTRY_NOT_ACTIVE', 'Ticket is not active for manual validation');
  }

  switch (input.action) {
    case 'authorize_entry': {
      if (ticket.validatedAt || invitation.status === 'validated') {
        throw new AppError(409, 'ENTRY_ALREADY_VALIDATED', 'Entry has already been validated');
      }

      if (requiresNoShowPreauth(invitation)) {
        await releaseInvitationPreAuthHold(invitation.id);
      }

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

      await logManualValidationScan(staffMemberId, ticket, input.action, 'valid');
      break;
    }
    case 'reject_access':
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'rejected', respondedAt: now },
      });
      await logManualValidationScan(staffMemberId, ticket, input.action, 'supervisor_resolved');
      break;
    case 'generate_temporary_qr': {
      const expiresAt = new Date(now.getTime() + TEMPORARY_QR_VALIDITY_MINUTES * 60 * 1000);
      let qrPayload = ticket.qrPayload.trim();

      if (!qrPayload) {
        qrPayload = generateQrPayload(ticket.id, invitation.eventId);
      }

      await prisma.invitationTicket.update({
        where: { id: ticket.id },
        data: {
          qrPayload,
          unlockAt: now,
        },
      });

      ticket.qrPayload = qrPayload;
      ticket.unlockAt = now;

      await logManualValidationScan(staffMemberId, ticket, input.action, 'supervisor_resolved');

      await invitationAuditService.log({
        invitationId: invitation.id,
        actorType: 'system',
        action: `${MANUAL_VALIDATION_ACTION_PREFIX}${input.action}`,
        result: 'success',
        metadata: {
          staff_member_id: staffMemberId,
          ticket_id: ticket.id,
          reason: input.reason,
          notes: input.notes.trim(),
          temporary_qr_expires_at: expiresAt.toISOString(),
          temporary_qr_validity_minutes: TEMPORARY_QR_VALIDITY_MINUTES,
        },
      });

      return {
        applied: true,
        action: input.action,
        ticket_id: ticket.id,
        entry_code: ticket.manualEntryId,
        temporary_qr: {
          qr_payload: qrPayload,
          entry_code: ticket.manualEntryId,
          guest_name: invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest',
          expires_at: expiresAt.toISOString(),
          validity_minutes: TEMPORARY_QR_VALIDITY_MINUTES,
        },
        context: await formatEntryManualValidationContext(
          (await loadTicket(ticket.id)) as TicketWithInvitation,
        ),
      };
    }
    default:
      throw new AppError(400, 'INVALID_MANUAL_VALIDATION_ACTION', 'Unsupported action');
  }

  await invitationAuditService.log({
    invitationId: invitation.id,
    actorType: 'system',
    action: `${MANUAL_VALIDATION_ACTION_PREFIX}${input.action}`,
    result: 'success',
    metadata: {
      staff_member_id: staffMemberId,
      ticket_id: ticket.id,
      reason: input.reason,
      notes: input.notes.trim(),
    },
  });

  return {
    applied: true,
    action: input.action,
    ticket_id: ticket.id,
    entry_code: ticket.manualEntryId,
    context: await formatEntryManualValidationContext(
      (await loadTicket(ticket.id)) as TicketWithInvitation,
    ),
  };
}

export const staffSupervisorEntryManualValidationService = {
  async getManualValidationContext(ticketId: string) {
    const ticket = await loadTicket(ticketId);
    return formatEntryManualValidationContext(ticket);
  },

  async getManualValidationContextByEntryCode(entryCode: string) {
    const ticket = await loadTicketByEntryCode(entryCode);
    return formatEntryManualValidationContext(ticket);
  },

  async applyManualValidation(
    ticketId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryManualValidationInput,
  ) {
    const ticket = await loadTicket(ticketId);
    return applyManualValidation(ticket, staffMemberId, input);
  },

  async applyManualValidationByEntryCode(
    entryCode: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryManualValidationInput,
  ) {
    const ticket = await loadTicketByEntryCode(entryCode);
    return applyManualValidation(ticket, staffMemberId, input);
  },
};
