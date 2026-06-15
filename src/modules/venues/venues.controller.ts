import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { venuesService } from './venues.service.js';
import {
  createVenueSchema,
  listVenuesQuerySchema,
  updateVenueSchema,
} from './venues.validators.js';

export const venuesController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listVenuesQuerySchema.parse(req.query);
      const venues = await venuesService.list(query);
      res.json(successResponse({ venues }));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await venuesService.getById(String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createVenueSchema.parse(req.body);
      const data = await venuesService.create(body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateVenueSchema.parse(req.body);
      const data = await venuesService.update(String(req.params.id), body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await venuesService.remove(String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
