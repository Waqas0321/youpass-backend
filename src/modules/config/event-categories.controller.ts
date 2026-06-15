import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { eventCategoriesService } from './event-categories.service.js';

export const eventCategoriesController = {
  listActive: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const event_categories = await eventCategoriesService.listActive();
      res.json(successResponse({ event_categories }));
    } catch (err) {
      next(err);
    }
  },

  listAll: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const event_categories = await eventCategoriesService.listAll();
      res.json(successResponse({ event_categories }));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventCategoriesService.create(req.body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventCategoriesService.update(String(req.params.id), req.body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
