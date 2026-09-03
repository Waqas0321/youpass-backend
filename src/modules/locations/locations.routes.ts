import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { locationsController } from './locations.controller.js';
import { locationSearchQuerySchema } from './locations.validators.js';

export const locationsRouter = Router();

locationsRouter.get(
  '/search',
  validate(locationSearchQuerySchema, 'query'),
  locationsController.search,
);
