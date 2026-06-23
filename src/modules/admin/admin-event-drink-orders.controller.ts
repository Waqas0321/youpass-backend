import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminEventDrinkOrdersService } from './admin-event-drink-orders.service.js';
import type { AdminDrinkOrderQrStatus } from './admin-event-drink-orders.formatter.js';

function parseListQuery(req: Request) {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const qrStatus = req.query.qr_status?.toString() as AdminDrinkOrderQrStatus | undefined;

  return {
    q: req.query.q?.toString(),
    page: Number.isFinite(page) ? page : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    product_id: req.query.product_id?.toString(),
    qr_status: qrStatus,
    date_from: req.query.date_from?.toString(),
    date_to: req.query.date_to?.toString(),
  };
}

export const adminEventDrinkOrdersController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const payload = await adminEventDrinkOrdersService.listForEvent(
        eventId,
        parseListQuery(req),
      );
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const orderId = String(req.params.orderId);
      const order = await adminEventDrinkOrdersService.getForEvent(eventId, orderId);
      res.json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },

  reissueQr: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const orderId = String(req.params.orderId);
      const order = await adminEventDrinkOrdersService.reissueQr(eventId, orderId);
      res.json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },

  refund: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const orderId = String(req.params.orderId);
      const order = await adminEventDrinkOrdersService.refund(eventId, orderId);
      res.json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },

  invalidate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const orderId = String(req.params.orderId);
      const order = await adminEventDrinkOrdersService.invalidate(eventId, orderId);
      res.json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },

  exportCsv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const csv = await adminEventDrinkOrdersService.exportCsv(eventId, parseListQuery(req));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="event-${eventId}-orders.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
};
