import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { waitlistService } from './waitlist.service.js';

function userContext(req: Request) {
  return { userId: req.user!.id, userPhone: req.user!.phone };
}

export const waitlistController = {
  getJoinPreview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, userPhone } = userContext(req);
      const data = await waitlistService.getJoinPreview(String(req.params.id), userId, userPhone);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  join: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, userPhone } = userContext(req);
      const data = await waitlistService.join(String(req.params.id), userId, userPhone);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  leave: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = userContext(req);
      const data = await waitlistService.leave(String(req.params.id), userId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getPosition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = userContext(req);
      const data = await waitlistService.getPosition(String(req.params.id), userId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  claimOffer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, userPhone } = userContext(req);
      const data = await waitlistService.claimOffer(String(req.params.id), userId, userPhone);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
