import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { ticketOrdersService } from './ticket-orders.service.js';
import { assignTicketSlotSchema, checkoutSchema } from './ticket-orders.validators.js';

export const ticketOrdersController = {
  checkout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = checkoutSchema.parse(req.body ?? {});
      const data = await ticketOrdersService.checkout(
        req.user!.id,
        String(req.params.eventId),
        body,
      );
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listAssignments: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ticketOrdersService.listAssignments(
        req.user!.id,
        String(req.params.orderId),
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
        String(req.params.orderId),
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
        String(req.params.orderId),
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
        String(req.params.orderId),
        String(req.params.slotId),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
