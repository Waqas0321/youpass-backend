import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { eventDrinksService } from './event-drinks.service.js';

export const eventDrinksController = {
  getMenu: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const userId = req.user!.id;
      const menu = await eventDrinksService.getMenuForUser(userId, eventId);
      res.json(successResponse(menu));
    } catch (err) {
      next(err);
    }
  },
};
