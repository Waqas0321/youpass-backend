import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { successResponse } from '../../common/utils/crypto.js';
import { staffScanService } from './staff-scan.service.js';
import { staffScanSyncService } from './staff-scan-sync.service.js';
import type { StaffScanRecentQuery, StaffScanSyncInput } from './staff-scan.validators.js';

export const staffScanController = {
  scanEntry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffScanService.scanEntry(
        req.body.qr_payload,
        req.staffMember!,
      );
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  scanProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffScanService.scanProduct(
        req.body.qr_payload,
        req.staffMember!,
      );
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  syncOffline: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.sessionId;
      if (!sessionId) {
        throw new AppError(401, 'SESSION_INVALID', 'Staff session is required');
      }
      const body = req.body as StaffScanSyncInput;
      const data = await staffScanSyncService.syncOfflineScans(
        req.staffMember!,
        sessionId,
        body,
      );
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listRecent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as StaffScanRecentQuery;
      const data = await staffScanService.listRecentScans(
        req.staffMember!,
        query.scan_type,
        query.limit,
      );
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listActiveEvents: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffScanService.listActiveEvents(req.staffMember!);
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
