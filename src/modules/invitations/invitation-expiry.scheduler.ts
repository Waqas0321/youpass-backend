import { prisma } from '../../config/database.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';
import { isInvitationExpired, expireInvitationRecord } from './invitation-lifecycle.service.js';
import { invitationAuditService } from './invitation-audit.service.js';
import { triggerWaitlistForReleasedSlot } from '../waitlist/waitlist-slot-release.hook.js';

const PURGE_INTERVAL_MS = 15 * 60 * 1000;

export async function purgeAllExpiredPendingInvitations(): Promise<number> {
  const { expiryDays } = await invitationConfigService.getConfig();
  const now = new Date();

  const candidates = await prisma.invitation.findMany({
    where: { status: { in: ['sent', 'viewed'] } },
    select: {
      id: true,
      sentAt: true,
      expiresAt: true,
      source: true,
      status: true,
      eventId: true,
      producerId: true,
      assignedSlot: true,
    },
  });

  const expired = candidates.filter((invitation) =>
    isInvitationExpired(invitation, expiryDays, now),
  );

  if (expired.length === 0) {
    return 0;
  }

  const freedSlotIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const invitation of expired) {
      const freedSlotId = await expireInvitationRecord(tx, invitation);
      if (freedSlotId) {
        freedSlotIds.push(freedSlotId);
      }
      await invitationAuditService.log({
        invitationId: invitation.id,
        actorType: 'system',
        action: 'release_expired',
        result: 'success',
      });
    }
  });

  for (const freedSlotId of freedSlotIds) {
    await triggerWaitlistForReleasedSlot(freedSlotId);
  }

  return expired.length;
}

export function startInvitationExpiryScheduler(): void {
  const run = async () => {
    try {
      const removed = await purgeAllExpiredPendingInvitations();
      if (removed > 0) {
        console.log(`[invitations] Purged ${removed} expired pending invitation(s)`);
      }
    } catch (error) {
      console.error('[invitations] Expiry purge failed:', error);
    }
  };

  void run();
  setInterval(run, PURGE_INTERVAL_MS);
}
