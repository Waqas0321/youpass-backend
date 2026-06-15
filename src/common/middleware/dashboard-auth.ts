import type { Request } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import { readAdminKeyFromRequest } from './admin-api-key.js';

export function assertDashboardApiKey(req: Request): void {
  if (env.NODE_ENV === 'development' && !env.ADMIN_API_KEY) {
    return;
  }

  const apiKey = readAdminKeyFromRequest(req);
  if (!env.ADMIN_API_KEY || apiKey !== env.ADMIN_API_KEY) {
    throw new AppError(401, 'DASHBOARD_AUTH_REQUIRED', 'Dashboard authentication required');
  }
}

export function resolveProducerId(req: Request): string {
  assertDashboardApiKey(req);
  const producerId = req.header('x-producer-id')?.trim();
  if (!producerId) {
    throw new AppError(400, 'PRODUCER_ID_REQUIRED', 'x-producer-id header is required');
  }
  return producerId;
}
