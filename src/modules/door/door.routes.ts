import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/utils/crypto.js';
import { invitationDoorValidationService } from '../invitations/invitation-door-validation.service.js';

const validateQrSchema = z.object({
  qr_payload: z.string().min(8),
});

function assertDoorValidatorAuth(req: Request) {
  const apiKey = req.header('x-admin-api-key') ?? req.header('x-door-api-key');
  if (!env.ADMIN_API_KEY || apiKey !== env.ADMIN_API_KEY) {
    throw new AppError(401, 'DOOR_AUTH_REQUIRED', 'Door validator authentication required');
  }
}

export const doorRouter = Router();

doorRouter.post(
  '/validate',
  validate(validateQrSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertDoorValidatorAuth(req);
      const data = await invitationDoorValidationService.validateQrPayload(
        req.body.qr_payload,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
);
