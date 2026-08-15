import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../errors/app-error.js';
import { AUTH_ERROR_CODES } from '../../config/constants.js';
import type { StaffJwtPayload } from '../types/auth.js';
import { hashToken } from '../utils/crypto.js';
import { staffActiveSessionWhere, isSessionActive, isSessionExpired } from '../utils/session-query.js';

export async function authenticateStaff(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    }

    const token = header.slice(7).trim();
    let payload: StaffJwtPayload;

    try {
      payload = jwt.verify(token, env.JWT_SECRET) as StaffJwtPayload;
    } catch {
      throw new AppError(401, AUTH_ERROR_CODES.SESSION_INVALID, 'Invalid or expired session');
    }

    if (payload.typ !== 'staff') {
      throw new AppError(401, AUTH_ERROR_CODES.SESSION_INVALID, 'Invalid staff session');
    }

    const tokenHash = hashToken(token);
    const session = await prisma.staffSession.findFirst({
      where: {
        id: payload.sessionId,
        staffMemberId: payload.sub,
        tokenHash,
        ...staffActiveSessionWhere,
      },
      include: {
        staffMember: {
          include: { role: true, zone: true },
        },
      },
    });

    if (
      !session ||
      !isSessionActive(session.revokedAt) ||
      isSessionExpired(session.expiresAt)
    ) {
      throw new AppError(401, AUTH_ERROR_CODES.SESSION_INVALID, 'Session is no longer valid');
    }

    await prisma.staffSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    req.staffMember = session.staffMember;
    req.sessionId = session.id;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
