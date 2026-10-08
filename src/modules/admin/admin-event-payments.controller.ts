import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminEventPaymentsService } from './admin-event-payments.service.js';

export const adminEventPaymentsController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const payload = await adminEventPaymentsService.getForEvent(eventId);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },
};
