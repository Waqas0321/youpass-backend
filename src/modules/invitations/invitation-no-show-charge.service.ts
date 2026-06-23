import { prisma } from '../../config/database.js';
import { requiresNoShowPreauth } from './invitation-product-type.utils.js';
import { capturePreauthorizedPayment } from './invitation-payment.service.js';
import {
  guaranteedPassNotificationService,
  resolveGuestContact,
} from './guaranteed-pass-notification.service.js';
import { invitationAuditService } from './invitation-audit.service.js';
import { invitationPreAuthService } from './invitation-preauth.service.js';

const MAX_CAPTURE_ATTEMPTS = 3;

/**
 * After an event ends, charges guests who accepted a Guaranteed Pass
 * but did not attend and did not cancel before the deadline.
 */
export const invitationNoShowChargeService = {
  async processNoShowsForEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return { charged: 0, failed: 0 };
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        eventId,
        status: { in: ['accepted', 'validated'] },
        type: { in: ['guaranteed', 'free'] },
      },
      include: {
        ticket: true,
        producer: true,
        recipient: true,
        preAuth: true,
      },
    });

    let charged = 0;
    let failed = 0;

    for (const invitation of invitations) {
      if (!requiresNoShowPreauth(invitation)) {
        continue;
      }

      if (invitation.ticket?.validatedAt != null || invitation.status === 'validated') {
        continue;
      }

      if (invitation.status === 'canceled' || invitation.status === 'charged') {
        continue;
      }

      const preAuth = invitation.preAuth;
      if (!preAuth || preAuth.status !== 'pre_authorized') {
        continue;
      }

      const amount = invitation.entryValue;
      if (amount <= 0) {
        continue;
      }

      const priorFailures = await invitationAuditService.countFailures(
        invitation.id,
        'capture_no_show_charge',
      );
      if (priorFailures >= MAX_CAPTURE_ATTEMPTS) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'failed' },
        });
        failed += 1;
        continue;
      }

      try {
        await capturePreauthorizedPayment(preAuth.gatewayTransactionId, amount);
        await invitationPreAuthService.captureInvitationPreAuth(invitation.id);

        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'charged' },
        });

        const contact = resolveGuestContact(invitation.recipient, invitation);
        await guaranteedPassNotificationService.sendNoShowCharge({
          invitation,
          event,
          producer: invitation.producer,
          recipient: invitation.recipient,
          inviterName: invitation.producer.name,
          ...contact,
        });

        await invitationAuditService.log({
          invitationId: invitation.id,
          actorType: 'system',
          action: 'capture_no_show_charge',
          result: 'success',
          metadata: { amount, currency: invitation.chargeCurrency },
        });

        charged += 1;
      } catch (error) {
        const nextAttempt = priorFailures + 1;
        const isFinalFailure = nextAttempt >= MAX_CAPTURE_ATTEMPTS;

        await invitationAuditService.log({
          invitationId: invitation.id,
          actorType: 'system',
          action: 'capture_no_show_charge',
          result: 'failure',
          metadata: {
            attempt: nextAttempt,
            final_failure: isFinalFailure,
            error: error instanceof Error ? error.message : 'unknown_error',
          },
        });

        if (isFinalFailure) {
          await invitationPreAuthService.failInvitationPreAuth(invitation.id);
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: 'failed' },
          });
          failed += 1;
        }
      }
    }

    return { charged, failed };
  },
};
