import { prisma } from '../../config/database.js';
import { sendTwilioWhatsApp, useLiveTwilioWhatsApp } from '../messaging/twilio-whatsapp.service.js';

type DeclineNotificationInput = {
  inviterUserId: string | null;
  recipientName: string | null;
  eventTitle: string;
};

export async function notifyInviterInvitationDeclined(
  input: DeclineNotificationInput,
): Promise<void> {
  if (!input.inviterUserId) {
    return;
  }

  const inviter = await prisma.user.findUnique({
    where: { id: input.inviterUserId },
    select: { phone: true, fullName: true },
  });

  if (!inviter?.phone) {
    return;
  }

  const guestLabel = input.recipientName?.trim() || 'Your guest';
  const body =
    `YouPass: ${guestLabel} declined your invitation to ${input.eventTitle}. ` +
    'The ticket slot is available again in My Tickets.';

  if (useLiveTwilioWhatsApp()) {
    try {
      await sendTwilioWhatsApp({ toE164: inviter.phone, body });
    } catch (error) {
      console.error('[invitations] Failed to notify inviter of decline:', error);
    }
    return;
  }

  console.log(`[Twilio MOCK/decline-notify] → ${inviter.phone} | ${body}`);
}
