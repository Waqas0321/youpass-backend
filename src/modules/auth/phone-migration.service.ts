import { prisma } from '../../config/database.js';
import { linkPendingInvitationsByPhone } from '../invitations/invitation-link.service.js';

/** Re-link guest invitations and assignment records when the user changes phone. */
export async function migrateUserPhoneData(
  userId: string,
  oldPhone: string,
  newPhone: string,
): Promise<{ invitations_updated: number; slots_updated: number; linked_invitations: number }> {
  const [invitations, slots] = await prisma.$transaction(async (tx) => {
    const invitationResult = await tx.invitation.updateMany({
      where: { recipientPhone: oldPhone },
      data: { recipientPhone: newPhone },
    });

    const slotResult = await tx.ticketSlot.updateMany({
      where: { guestPhone: oldPhone },
      data: { guestPhone: newPhone },
    });

    return [invitationResult.count, slotResult.count] as const;
  });

  const linkedInvitations = await linkPendingInvitationsByPhone(userId, newPhone);

  return {
    invitations_updated: invitations,
    slots_updated: slots,
    linked_invitations: linkedInvitations,
  };
}
