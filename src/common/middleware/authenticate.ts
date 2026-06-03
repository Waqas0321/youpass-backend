import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../errors/app-error.js';
import { AUTH_ERROR_CODES } from '../../config/constants.js';
import type { JwtPayload } from '../types/auth.js';
import { hashToken } from '../utils/crypto.js';
import { activeSessionWhere, isSessionActive, isSessionExpired } from '../utils/session-query.js';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    }

    const token = header.slice(7).trim();
    let payload: JwtPayload;

    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new AppError(401, AUTH_ERROR_CODES.SESSION_INVALID, 'Invalid or expired session');
    }

    const tokenHash = hashToken(token);
    const session = await prisma.userSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        tokenHash,
        ...activeSessionWhere,
      },
      include: { user: true },
    });

    if (
      !session ||
      !isSessionActive(session.revokedAt) ||
      isSessionExpired(session.expiresAt) ||
      session.user.accountStatus !== 'active'
    ) {
      throw new AppError(401, AUTH_ERROR_CODES.SESSION_INVALID, 'Session is no longer valid');
    }

    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    req.user = session.user;
    req.sessionId = session.id;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  authenticate(req, _res, next).catch(next);
}
