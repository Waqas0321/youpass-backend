import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { homeBannersService } from './home-banners.service.js';

export const homeBannersController = {
  getCarouselConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse({ carousel: homeBannersService.getCarouselConfig() }));
    } catch (err) {
      next(err);
    }
  },

  listAll: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const home_banners = await homeBannersService.listAll();
      res.json(successResponse({ home_banners }));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await homeBannersService.create(req.body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await homeBannersService.update(String(req.params.id), req.body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await homeBannersService.remove(String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
