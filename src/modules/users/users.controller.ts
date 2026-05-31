import type { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service.js';
import { successResponse } from '../../common/utils/crypto.js';

export const usersController = {
  getProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getProfile(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getWelcomeData: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getWelcomeData(req.user!);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getProfileCompleteness: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getProfileCompleteness(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.logout(req.user!, req.sessionId!);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
