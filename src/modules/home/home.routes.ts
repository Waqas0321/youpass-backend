import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { homeFeedQuerySchema } from '../events/events.validators.js';
import { homeService } from './home.service.js';

export const homeRouter = {
  getInitialFeed: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = homeFeedQuerySchema.parse(req.query);
      const data = await homeService.getInitialFeed(query, req.user);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
