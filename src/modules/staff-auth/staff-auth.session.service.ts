import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { StaffMember } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { hashToken } from '../../common/utils/crypto.js';
import { staffActiveSessionWhere } from '../../common/utils/session-query.js';
import { extractDeviceId } from '../../common/utils/device-id.js';
import type { AuthRequestContext, StaffJwtPayload } from '../../common/types/auth.js';

export type StaffSessionResult = {
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

async function revokeSessionsForDevice(staffMemberId: string, deviceId: string): Promise<void> {
  const sessions = await prisma.staffSession.findMany({
    where: { staffMemberId, ...staffActiveSessionWhere },
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

  await prisma.staffSession.updateMany({
    where: { id: { in: sessionIds }, staffMemberId },
    data: { revokedAt: new Date() },
  });
}

export async function createStaffSession(
  staffMember: StaffMember,
  context?: AuthRequestContext,
): Promise<StaffSessionResult> {
  const deviceId = extractDeviceId(context);
  if (deviceId) {
    await revokeSessionsForDevice(staffMember.id, deviceId);
  }

  const sessionId = crypto.randomBytes(12).toString('hex');

  const payload: StaffJwtPayload = {
    sub: staffMember.id,
    sessionId,
    phone: staffMember.phone,
    typ: 'staff',
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

  const session = await prisma.staffSession.create({
    data: {
      id: sessionId,
      staffMemberId: staffMember.id,
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

export async function revokeStaffSession(sessionId: string, staffMemberId: string): Promise<void> {
  await prisma.staffSession.updateMany({
    where: { id: sessionId, staffMemberId, ...staffActiveSessionWhere },
    data: { revokedAt: new Date() },
  });
}
