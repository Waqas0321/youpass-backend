import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminEventDashboardService } from './admin-event-dashboard.service.js';

export const adminEventDashboardController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const payload = await adminEventDashboardService.getEventDashboard(eventId);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  getHourlyTicketSales: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const period = adminEventDashboardService.parseSalesPeriod(req.query.period);
      const payload = await adminEventDashboardService.getHourlyTicketSales(eventId, period);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  getPanels: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const period = adminEventDashboardService.parseSalesPeriod(req.query.period);
      const payload = await adminEventDashboardService.getDashboardPanels(eventId, period);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },
};
