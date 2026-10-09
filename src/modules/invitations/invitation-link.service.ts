import { prisma } from '../../config/database.js';

/** Attach pending guest invitations to a user account after login/register. */
export async function linkPendingInvitationsByPhone(userId: string, phone: string): Promise<number> {
  const result = await prisma.invitation.updateMany({
    where: {
      source: 'guest',
      recipientPhone: phone,
      // Prisma MongoDB: `null` alone misses invitations where the field was never set.
      OR: [{ recipientUserId: null }, { recipientUserId: { isSet: false } }],
      status: { in: ['sent', 'viewed'] },
    },
    data: { recipientUserId: userId },
  });

  return result.count;
}
