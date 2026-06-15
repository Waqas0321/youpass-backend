import type { Request, Response, NextFunction } from 'express';
import { eventsService } from './events.service.js';
import { vipVenueService } from '../vip-venue/vip-venue.service.js';
import { successResponse } from '../../common/utils/crypto.js';
import { featuredEventsQuerySchema, listEventsQuerySchema } from './events.validators.js';

function userId(req: Request): string | undefined {
  return req.user?.id;
}

export const eventsController = {
  listTypes: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventsService.listEventTypes();
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listEventsQuerySchema.parse(req.query);
      const data = await eventsService.listEvents(query, userId(req));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  featured: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = featuredEventsQuerySchema.parse(req.query);
      const data = await eventsService.getFeaturedEvents(query, userId(req));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventsService.getEventById(String(req.params.id), userId(req));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getAvailability: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.getEventAvailability(String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventsService.createEvent(req.body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventsService.updateEvent(String(req.params.id), req.body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventsService.deleteEvent(String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
