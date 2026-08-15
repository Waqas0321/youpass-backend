import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { staffScanService } from './staff-scan.service.js';
import type { StaffScanRecentQuery } from './staff-scan.validators.js';

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
};
