import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminVenueLayoutService } from './admin-venue-layout.service.js';
import {
  adminVenueLayoutSchema,
  adminVenueLayoutUpdateSchema,
  adminVenueTableSchema,
  adminVenueTableUpdateSchema,
  adminVenueZoneSchema,
  adminVenueZoneUpdateSchema,
} from './admin-venue-layout.validators.js';

export const adminVenueLayoutController = {
  getEventVenueLayout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const data = await adminVenueLayoutService.getLayout(eventId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  upsertEventVenueLayout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = adminVenueLayoutSchema.parse(req.body);
      const layout = await adminVenueLayoutService.upsertLayout(eventId, body);
      res.json(successResponse(layout));
    } catch (err) {
      next(err);
    }
  },

  deleteEventVenueLayout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const result = await adminVenueLayoutService.deleteLayout(eventId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },

  createVenueZone: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = adminVenueZoneSchema.parse(req.body);
      const zone = await adminVenueLayoutService.createZone(eventId, body);
      res.status(201).json(successResponse(zone));
    } catch (err) {
      next(err);
    }
  },

  updateVenueZone: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const zoneId = String(req.params.zoneId);
      const body = adminVenueZoneUpdateSchema.parse(req.body);
      const zone = await adminVenueLayoutService.updateZone(eventId, zoneId, body);
      res.json(successResponse(zone));
    } catch (err) {
      next(err);
    }
  },

  deleteVenueZone: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const zoneId = String(req.params.zoneId);
      const result = await adminVenueLayoutService.deleteZone(eventId, zoneId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },

  createVenueTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const zoneId = String(req.params.zoneId);
      const body = adminVenueTableSchema.parse(req.body);
      const table = await adminVenueLayoutService.createTable(eventId, zoneId, body);
      res.status(201).json(successResponse(table));
    } catch (err) {
      next(err);
    }
  },

  updateVenueTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const zoneId = String(req.params.zoneId);
      const tableId = String(req.params.tableId);
      const body = adminVenueTableUpdateSchema.parse(req.body);
      const table = await adminVenueLayoutService.updateTable(eventId, zoneId, tableId, body);
      res.json(successResponse(table));
    } catch (err) {
      next(err);
    }
  },

  deleteVenueTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const zoneId = String(req.params.zoneId);
      const tableId = String(req.params.tableId);
      const result = await adminVenueLayoutService.deleteTable(eventId, zoneId, tableId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },
};
