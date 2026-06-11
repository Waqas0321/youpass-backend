import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { analyticsController } from './analytics.controller.js';

export const analyticsRouter = Router();

analyticsRouter.post(
  '/event/registration-completed',
  authenticate,
  analyticsController.registrationCompleted,
);
