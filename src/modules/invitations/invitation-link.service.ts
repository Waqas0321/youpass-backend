import { prisma } from '../../config/database.js';

/** Attach pending guest invitations to a user account after login/register. */
export async function linkPendingInvitationsByPhone(userId: string, phone: string): Promise<number> {
  const result = await prisma.invitation.updateMany({
    where: {
      source: 'guest',
      recipientPhone: phone,
      recipientUserId: null,
      status: { in: ['sent', 'viewed'] },
    },
    data: { recipientUserId: userId },
  });

  return result.count;
}
