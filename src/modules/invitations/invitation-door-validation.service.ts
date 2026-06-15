import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { resolveInvitationProductKind } from './invitation-product-type.utils.js';
import {
  guaranteedPassNotificationService,
  resolveGuestContact,
} from './guaranteed-pass-notification.service.js';
import { releaseInvitationPreAuthHold } from './invitation-lifecycle.service.js';

export const invitationDoorValidationService = {
  async validateQrPayload(qrPayload: string) {
    const ticket = await prisma.invitationTicket.findFirst({
      where: { qrPayload },
      include: {
        invitation: {
          include: {
            event: true,
            producer: true,
            recipient: true,
            preAuth: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not recognised');
    }

    const invitation = ticket.invitation;

    if (invitation.status !== 'accepted' && invitation.status !== 'validated') {
      throw new AppError(409, 'QR_INVALID', 'Ticket is not active');
    }

    if (ticket.validatedAt) {
      return {
        valid: true,
        already_validated: true,
        invitation_id: invitation.id,
        event_title: invitation.event.title,
        guest_name: invitation.recipient?.fullName ?? invitation.recipientName,
      };
    }

    const now = new Date();
    const productKind = resolveInvitationProductKind(invitation);
    let preauthReleased = false;

    if (productKind === 'guaranteed_pass' && invitation.preAuth?.status === 'pre_authorized') {
      await releaseInvitationPreAuthHold(invitation.id);
      preauthReleased = true;
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
    };
  },
};
