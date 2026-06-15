import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

export type AuditActorType = 'guest' | 'producer' | 'system';

type LogInvitationActionInput = {
  invitationId?: string;
  actorUserId?: string;
  actorType: AuditActorType;
  action: string;
  result: 'success' | 'failure' | 'skipped';
  metadata?: Prisma.InputJsonValue;
};

export const invitationAuditService = {
  async log(input: LogInvitationActionInput): Promise<void> {
    try {
      await prisma.invitationAuditLog.create({
        data: {
          invitationId: input.invitationId,
          actorUserId: input.actorUserId,
          actorType: input.actorType,
          action: input.action,
          result: input.result,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      console.error('[invitation-audit] Failed to log action', input.action, error);
    }
  },

  async countFailures(invitationId: string, action: string): Promise<number> {
    return prisma.invitationAuditLog.count({
      where: {
        invitationId,
        action,
        result: 'failure',
      },
    });
  },
};
