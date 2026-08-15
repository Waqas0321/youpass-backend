import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminEventStaffQrService } from './admin-event-staff-qr.service.js';

export const adminEventStaffQrController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const payload = await adminEventStaffQrService.getEventStaffQrDashboard(eventId);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  listScans: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const payload = await adminEventStaffQrService.listEventStaffQrScans(eventId, page, limit);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },
};
