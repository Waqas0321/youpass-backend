import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { eventListingConfigService } from '../../common/services/event-listing-sort.service.js';

export const eventListingConfigController = {
  getConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const weights = await eventListingConfigService.getWeights();
      res.json(successResponse(eventListingConfigService.formatWeights(weights)));
    } catch (err) {
      next(err);
    }
  },

  updateConfig: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventListingConfigService.updateWeights({
        dateWeight: req.body.date_weight,
        locationWeight: req.body.location_weight,
        featuredWeight: req.body.featured_weight,
        pageSize: req.body.page_size,
      });
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
