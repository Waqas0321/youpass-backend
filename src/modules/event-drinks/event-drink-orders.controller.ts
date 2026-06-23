import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { eventDrinkOrdersService } from './event-drink-orders.service.js';

export const eventDrinkOrdersController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const userId = req.user!.id;
      const order = await eventDrinkOrdersService.createOrder(userId, eventId, req.body);
      res.status(201).json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },

  listMine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const complimentaryParam = req.query.complimentary;
      const complimentary =
        complimentaryParam === 'true'
          ? true
          : complimentaryParam === 'false'
            ? false
            : undefined;
      const payload = await eventDrinkOrdersService.listForUser(userId, {
        complimentary,
      });
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  getMine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const orderId = String(req.params.orderId);
      const order = await eventDrinkOrdersService.getForUser(userId, orderId);
      res.json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },
};
