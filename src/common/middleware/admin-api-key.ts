import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

function readAdminKey(req: Request): string | undefined {
  const raw =
    req.header('x-admin-key') ??
    req.header('x-admin-api-key') ??
    req.header('x-system-api-key');
  return raw?.trim() || undefined;
}

export function requireAdminApiKey(req: Request, _res: Response, next: NextFunction) {
  if (env.NODE_ENV === 'development' && !env.ADMIN_API_KEY) {
    next();
    return;
  }

  const key = readAdminKey(req);

  if (key && env.ADMIN_API_KEY && key === env.ADMIN_API_KEY) {
    next();
    return;
  }

  next(new AppError(401, 'UNAUTHORIZED', 'Admin API key required'));
}

export function readAdminKeyFromRequest(req: Request): string | undefined {
  return readAdminKey(req);
}
