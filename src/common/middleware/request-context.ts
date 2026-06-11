import type { NextFunction, Request, Response } from 'express';
import type { AuthRequestContext } from '../types/auth.js';

export function attachRequestContext(req: Request, _res: Response, next: NextFunction): void {
  const deviceIdHeader = req.headers['x-device-id'];
  const deviceId =
    typeof deviceIdHeader === 'string' && deviceIdHeader.trim().length >= 8
      ? deviceIdHeader.trim()
      : undefined;

  const ctx: AuthRequestContext = {
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    deviceInfo: {
      userAgent: req.headers['user-agent'],
      platform: req.headers['x-platform'] as string | undefined,
      appVersion: req.headers['x-app-version'] as string | undefined,
      ...(deviceId ? { deviceId } : {}),
    },
  };
  req.authContext = ctx;
  next();
}
