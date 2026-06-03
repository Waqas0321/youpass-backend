import type { Request, Response, NextFunction } from 'express';
import { favoritesService } from './favorites.service.js';
import { successResponse } from '../../common/utils/crypto.js';

export const favoritesController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await favoritesService.listFavoriteEvents(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  add: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await favoritesService.addFavorite(req.user!.id, String(req.params.eventId));
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await favoritesService.removeFavorite(req.user!.id, String(req.params.eventId));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
