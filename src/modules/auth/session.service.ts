import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import type { User } from '@prisma/client';
import { hashToken } from '../../common/utils/crypto.js';
import { activeSessionWhere } from '../../common/utils/session-query.js';
import { extractDeviceId } from '../../common/utils/device-id.js';
import type { JwtPayload } from '../../common/types/auth.js';
import type { AuthRequestContext } from '../../common/types/auth.js';

export type SessionResult = {
  accessToken: string;
  sessionId: string;
  expiresAt: string | null;
};

function sessionExpiresAt(accessToken: string): Date | null {
  const decoded = jwt.decode(accessToken) as { exp?: number } | null;
  if (!decoded?.exp) {
    return null;
  }
  return new Date(decoded.exp * 1000);
}

async function revokeSessionsForDevice(userId: string, deviceId: string): Promise<void> {
  const sessions = await prisma.userSession.findMany({
    where: { userId, ...activeSessionWhere },
    select: { id: true, deviceInfo: true },
  });

  const sessionIds = sessions
    .filter((session) => {
      const info = session.deviceInfo as { deviceId?: string } | null;
      return info?.deviceId === deviceId;
    })
    .map((session) => session.id);

  if (sessionIds.length === 0) {
    return;
  }

  await prisma.userSession.updateMany({
    where: { id: { in: sessionIds }, userId },
    data: { revokedAt: new Date() },
  });
}

export async function createSession(
  user: User,
  context?: AuthRequestContext,
): Promise<SessionResult> {
  const deviceId = extractDeviceId(context);
  if (deviceId) {
    await revokeSessionsForDevice(user.id, deviceId);
  }

  const sessionId = crypto.randomBytes(12).toString('hex');

  const payload: JwtPayload = {
    sub: user.id,
    sessionId,
    phone: user.phone,
  };

  const accessToken = env.JWT_SESSION_INDEFINITE
    ? jwt.sign(payload, env.JWT_SECRET)
    : jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      });

  const expiresAt = env.JWT_SESSION_INDEFINITE ? null : sessionExpiresAt(accessToken);
  const deviceInfo = {
    ...(context?.deviceInfo ?? {}),
    ...(deviceId ? { deviceId } : {}),
  };

  const session = await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(accessToken),
      deviceInfo: Object.keys(deviceInfo).length ? deviceInfo : undefined,
      ipAddress: context?.ipAddress,
      expiresAt,
    },
  });

  return {
    accessToken,
    sessionId: session.id,
    expiresAt: session.expiresAt?.toISOString() ?? null,
  };
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { id: sessionId, userId, ...activeSessionWhere },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: {
      userId,
      ...activeSessionWhere,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}
