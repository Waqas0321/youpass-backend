import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { locationsService } from './locations.service.js';
import type { LocationSearchQuery } from './locations.validators.js';

export const locationsController = {
  search: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as LocationSearchQuery;
      const results = await locationsService.search(query);
      res.json(
        successResponse({
          query: query.q,
          results,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
};
