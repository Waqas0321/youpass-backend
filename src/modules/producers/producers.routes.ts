import { Router } from 'express';
import { optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { producersController } from './producers.controller.js';

export const producersRouter = Router();

producersRouter.get('/:id', optionalAuthenticate, producersController.getProfile);
producersRouter.get(
  '/:id/upcoming-events',
  optionalAuthenticate,
  producersController.listUpcomingEvents,
);
