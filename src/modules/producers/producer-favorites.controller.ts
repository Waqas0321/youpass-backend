import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { producerFavoritesService } from '../producers/producers.service.js';
import { favoritesCombinedService } from '../producers/producers.service.js';

export const producerFavoritesController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await producerFavoritesService.listFollowedProducers(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  follow: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await producerFavoritesService.followProducer(
        req.user!.id,
        String(req.params.producerId),
      );
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  unfollow: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await producerFavoritesService.unfollowProducer(
        req.user!.id,
        String(req.params.producerId),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};

export const favoritesCombinedController = {
  listAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await favoritesCombinedService.listAllFavorites(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
