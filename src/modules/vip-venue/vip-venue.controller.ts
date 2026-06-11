import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { vipVenueService } from './vip-venue.service.js';

function userId(req: Request): string | undefined {
  return req.user?.id;
}

export const vipVenueController = {
  listTicketTypes: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.listTicketTypes(String(req.params.eventId));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getVenueLayout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.getVenueLayout(String(req.params.eventId));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listZoneTables: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.listZoneTables(
        String(req.params.eventId),
        String(req.params.zoneId),
        userId(req),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.getTable(
        String(req.params.eventId),
        String(req.params.tableId),
        userId(req),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  lockTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.lockTable(
        String(req.params.eventId),
        String(req.params.tableId),
        req.user!.id,
      );
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  releaseTableLock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.releaseTableLock(
        String(req.params.eventId),
        String(req.params.tableId),
        req.user!.id,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getRealtimeAvailability: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await vipVenueService.getRealtimeAvailability(
        String(req.params.eventId),
        userId(req),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
