import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminEventVipTablesService } from './admin-event-vip-tables.service.js';
import {
  adminVipTableActionSchema,
  adminVipTableEditSchema,
  adminVipTableMoveSchema,
} from './admin-event-vip-tables.validators.js';

export const adminEventVipTablesController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminEventVipTablesService.listTables(String(req.params.eventId));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  ensureLayout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminEventVipTablesService.ensureLayout(String(req.params.eventId));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listGuests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminEventVipTablesService.listGuests(
        String(req.params.eventId),
        String(req.params.tableId),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyAction: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminVipTableActionSchema.parse(req.body);
      const data = await adminEventVipTablesService.applyAction(
        String(req.params.eventId),
        String(req.params.tableId),
        body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  moveTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminVipTableMoveSchema.parse(req.body);
      const data = await adminEventVipTablesService.moveTable(
        String(req.params.eventId),
        String(req.params.tableId),
        body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  editTable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminVipTableEditSchema.parse(req.body);
      const data = await adminEventVipTablesService.editTable(
        String(req.params.eventId),
        String(req.params.tableId),
        body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  cancelGuest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminEventVipTablesService.cancelGuest(
        String(req.params.eventId),
        String(req.params.tableId),
        String(req.params.slotId),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
