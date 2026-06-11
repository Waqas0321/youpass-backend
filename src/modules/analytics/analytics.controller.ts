import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { analyticsService } from './analytics.service.js';
import { registrationCompletedSchema } from './analytics.validators.js';

export const analyticsController = {
  registrationCompleted: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = registrationCompletedSchema.parse(req.body ?? {});
      const data = await analyticsService.trackRegistrationCompleted(
        req.user!.id,
        input,
        req.authContext,
      );
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
