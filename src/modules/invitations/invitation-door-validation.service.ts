import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { requiresNoShowPreauth } from './invitation-product-type.utils.js';
import {
  guaranteedPassNotificationService,
  resolveGuestContact,
} from './guaranteed-pass-notification.service.js';
import { releaseInvitationPreAuthHold } from './invitation-lifecycle.service.js';
import { findInvitationTicketByScanInput } from './invitation-ticket-scan.utils.js';
import { supervisorOperationalStateService } from '../staff-supervisor/supervisor-operational-state.service.js';

export const invitationDoorValidationService = {
  async validateQrPayload(scanInput: string) {
    const ticket = await findInvitationTicketByScanInput(scanInput);

    if (!ticket) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not recognised');
    }

    const invitation = ticket.invitation;
    const operationalFlags = await supervisorOperationalStateService.getFlags(invitation.eventId);

    if (operationalFlags.validationsPaused) {
      throw new AppError(
        503,
        'VALIDATIONS_PAUSED',
        'Entry validations are temporarily paused by a supervisor',
      );
    }

    if (operationalFlags.vipAccessBlocked && invitation.tier === 'vip') {
      throw new AppError(403, 'VIP_ACCESS_BLOCKED', 'VIP access is temporarily blocked');
    }

    if (invitation.status !== 'accepted' && invitation.status !== 'validated') {
      throw new AppError(409, 'QR_INVALID', 'Ticket is not active');
    }

    const now = new Date();

    // Supervisor-authorized re-entry: unlockAt > validatedAt grants one more entry
    // without erasing the original validatedAt (first entry) record.
    if (ticket.validatedAt && ticket.unlockAt.getTime() > ticket.validatedAt.getTime()) {
      await prisma.invitationTicket.update({
        where: { id: ticket.id },
        data: {
          unlockAt: ticket.validatedAt,
          consumptionCount: (ticket.consumptionCount ?? 1) + 1,
        },
      });

      return {
        valid: true,
        approved: true,
        reentry: true,
        invitation_id: invitation.id,
        event_title: invitation.event.title,
        guest_name: invitation.recipient?.fullName ?? invitation.recipientName,
        qr_payload: ticket.qrPayload,
        entry_code: ticket.manualEntryId,
        first_validated_at: ticket.validatedAt.toISOString(),
        validated_at: ticket.validatedAt.toISOString(),
        reentry_at: now.toISOString(),
      };
    }

    if (ticket.validatedAt) {
      return {
        valid: true,
        already_validated: true,
        invitation_id: invitation.id,
        event_title: invitation.event.title,
        guest_name: invitation.recipient?.fullName ?? invitation.recipientName,
        qr_payload: ticket.qrPayload,
        entry_code: ticket.manualEntryId,
      };
    }

    let preauthReleased = false;

    if (requiresNoShowPreauth(invitation) && invitation.preAuth?.status === 'pre_authorized') {
      await releaseInvitationPreAuthHold(invitation.id);
      preauthReleased = true;
    }

    await prisma.$transaction(async (tx) => {
      await tx.invitationTicket.update({
        where: { id: ticket.id },
        data: {
          validatedAt: now,
          consumptionCount: 1,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'validated' },
      });
    });

    if (preauthReleased) {
      const contact = resolveGuestContact(invitation.recipient, invitation);
      await guaranteedPassNotificationService.sendDoorValidationRelease({
        invitation,
        event: invitation.event,
        producer: invitation.producer,
        recipient: invitation.recipient,
        inviterName: invitation.producer.name,
        ...contact,
      });
    }

    return {
      valid: true,
      approved: true,
      invitation_id: invitation.id,
      event_title: invitation.event.title,
      guest_name: invitation.recipient?.fullName ?? invitation.recipientName,
      preauth_released: preauthReleased,
      qr_payload: ticket.qrPayload,
      entry_code: ticket.manualEntryId,
      validated_at: now.toISOString(),
    };
  },
};
