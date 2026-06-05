import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { ticketsService } from './tickets.service.js';
import { ticketOrdersService } from '../ticket-orders/ticket-orders.service.js';
import { assignTicketSlotSchema } from '../ticket-orders/ticket-orders.validators.js';
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
      const data = await ticketsService.getTicketQr(
        req.user!.id,
        req.user!.phone,
        String(req.params.id),
      );
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

  /** Assign screen — accepts ticket id, ticket_order_id, or event id */
  listAssignments: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketOrdersService.listAssignments(
        req.user!.id,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  assignSlot: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = assignTicketSlotSchema.parse(req.body);
      const data = await ticketOrdersService.assignSlot(
        req.user!.id,
        String(req.params.id),
        String(req.params.slotId),
        body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  cancelAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketOrdersService.cancelAssignment(
        req.user!.id,
        String(req.params.id),
        String(req.params.slotId),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  resendAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketOrdersService.resendAssignment(
        req.user!.id,
        String(req.params.id),
        String(req.params.slotId),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
