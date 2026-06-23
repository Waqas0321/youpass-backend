import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import {
  adminEventDrinkCategorySchema,
  adminEventDrinkProductSchema,
  adminEventDrinkProductUpdateSchema,
} from './admin-event-drinks.validators.js';
import { adminEventDrinksService } from './admin-event-drinks.service.js';

export const adminEventDrinksController = {
  listCategories: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const categories = await adminEventDrinksService.listCategories(eventId);
      res.json(successResponse({ event_id: eventId, categories }));
    } catch (err) {
      next(err);
    }
  },

  createCategory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = adminEventDrinkCategorySchema.parse(req.body);
      const category = await adminEventDrinksService.createCategory(eventId, body);
      res.status(201).json(successResponse(category));
    } catch (err) {
      next(err);
    }
  },

  listProducts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const categorySlug =
        typeof req.query.category === 'string' && req.query.category !== 'all'
          ? req.query.category
          : undefined;
      const products = await adminEventDrinksService.listProducts(eventId, categorySlug);
      res.json(successResponse({ event_id: eventId, products }));
    } catch (err) {
      next(err);
    }
  },

  createProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = adminEventDrinkProductSchema.parse(req.body);
      const product = await adminEventDrinksService.createProduct(eventId, body);
      res.status(201).json(successResponse(product));
    } catch (err) {
      next(err);
    }
  },

  updateProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const productId = String(req.params.productId);
      const body = adminEventDrinkProductUpdateSchema.parse(req.body);
      const product = await adminEventDrinksService.updateProduct(eventId, productId, body);
      res.json(successResponse(product));
    } catch (err) {
      next(err);
    }
  },

  duplicateProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const productId = String(req.params.productId);
      const product = await adminEventDrinksService.duplicateProduct(eventId, productId);
      res.status(201).json(successResponse(product));
    } catch (err) {
      next(err);
    }
  },

  deleteProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const productId = String(req.params.productId);
      await adminEventDrinksService.deleteProduct(eventId, productId);
      res.json(successResponse({ deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
