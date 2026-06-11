import type { Request, Response, NextFunction } from 'express';
import { ticketOrdersService } from '../ticket-orders/ticket-orders.service.js';

export const webhooksController = {
  klap: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = String(req.body?.order_id ?? req.body?.reference ?? '');
      if (orderId && req.body?.status === 'paid') {
        await ticketOrdersService.fulfillPendingOrder(orderId);
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },

  stripe: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = req.body;
      const intent = event?.data?.object;
      const orderId = intent?.metadata?.order_id;
      if (event?.type === 'payment_intent.succeeded' && orderId) {
        await ticketOrdersService.fulfillPendingOrder(String(orderId));
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
};
