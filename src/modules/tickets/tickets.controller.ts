import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { ticketsService } from './tickets.service.js';
import {
  listPastTicketsQuerySchema,
  listUpcomingTicketsQuerySchema,
} from './tickets.validators.js';

export const ticketsController = {
  listUpcoming: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listUpcomingTicketsQuerySchema.parse(req.query);
      const data = await ticketsService.listUpcoming(req.user!.id, query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listPast: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listPastTicketsQuerySchema.parse(req.query);
      const data = await ticketsService.listPast(req.user!.id, query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketsService.getTicketDetail(req.user!.id, String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getQr: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketsService.getTicketQr(req.user!.id, String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  yearlySummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketsService.getYearlySummary(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
