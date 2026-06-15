import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { producersService } from './producers.service.js';

export const producersController = {
  getProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await producersService.getProducerProfile(
        String(req.params.id),
        req.user?.id,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listUpcomingEvents: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await producersService.listUpcomingEvents(
        String(req.params.id),
        req.user?.id,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
