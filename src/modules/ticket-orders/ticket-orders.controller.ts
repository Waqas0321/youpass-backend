import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { ticketOrdersService } from './ticket-orders.service.js';
import { assignTicketSlotSchema, checkoutSchema, confirmCheckoutSchema, guestLookupSchema } from './ticket-orders.validators.js';
import { verifyRecaptchaToken } from '../../common/services/recaptcha.service.js';

export const ticketOrdersController = {
  checkout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = checkoutSchema.parse(req.body ?? {});
      await verifyRecaptchaToken(body.recaptcha_token, 'checkout');
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

  confirmCheckout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = confirmCheckoutSchema.parse(req.body ?? {});
      const data = await ticketOrdersService.fulfillPendingOrder(body.order_id, req.user!.id);
      res.json(successResponse(data));
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

  lookupAssignGuests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = guestLookupSchema.parse(req.query);
      const data = await ticketOrdersService.lookupAssignGuests(req.user!.id, query.q);
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
