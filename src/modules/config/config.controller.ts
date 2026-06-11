import type { Request, Response, NextFunction } from 'express';
import { configService } from './config.service.js';
import { successResponse } from '../../common/utils/crypto.js';

export const configController = {
  getAppConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await configService.getAppConfig();
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getAuthConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = configService.getAuthConfig();
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getSecurityConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = configService.getSecurityConfig();
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listCountries: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await configService.listCountries();
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getBrowseCategories: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await configService.getBrowseCategories();
      res.json(successResponse({ categories: data }));
    } catch (err) {
      next(err);
    }
  },

  getCurrency: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const country = String(req.params.country);
      const data = await configService.getCurrency(country);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getLanguage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const country = String(req.params.country);
      const data = await configService.getLanguage(country);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getPaymentGateway: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const country = String(req.params.country);
      const data = await configService.getPaymentGateway(country);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
