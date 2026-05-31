import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import type { User } from '@prisma/client';
import { hashToken } from '../../common/utils/crypto.js';
import type { JwtPayload } from '../../common/types/auth.js';
import type { AuthRequestContext } from '../../common/types/auth.js';

export type SessionResult = {
  accessToken: string;
  sessionId: string;
  expiresAt: string | null;
};

export async function createSession(
  user: User,
  context?: AuthRequestContext,
): Promise<SessionResult> {
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash: 'pending',
      deviceInfo: (context?.deviceInfo ?? undefined) as object | undefined,
      ipAddress: context?.ipAddress,
      expiresAt: null,
    },
  });

  const payload: JwtPayload = {
    sub: user.id,
    sessionId: session.id,
    phone: user.phone,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  await prisma.userSession.update({
    where: { id: session.id },
    data: { tokenHash: hashToken(accessToken) },
  });

  return {
    accessToken,
    sessionId: session.id,
    expiresAt: session.expiresAt?.toISOString() ?? null,
  };
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}
