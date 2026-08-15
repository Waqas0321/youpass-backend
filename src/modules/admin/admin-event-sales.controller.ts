import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminEventSalesService } from './admin-event-sales.service.js';
import { setEventSalesPausedSchema } from './admin-event-sales.validators.js';

export const adminEventSalesController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const data = await adminEventSalesService.getSalesStatus(eventId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = setEventSalesPausedSchema.parse(req.body);
      const data = await adminEventSalesService.setSalesPaused(eventId, body.sales_paused);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
