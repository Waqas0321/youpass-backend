import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';

export const invitationConfigController = {
  getConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await invitationConfigService.getConfig();
      res.json(successResponse(invitationConfigService.formatConfig(config)));
    } catch (err) {
      next(err);
    }
  },

  updateConfig: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invitationConfigService.updateConfig({
        expiryDays: req.body.expiry_days,
      });
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
