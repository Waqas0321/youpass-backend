import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { kushkiPaymentsController } from './kushki.controller.js';

export const kushkiPaymentsRouter = Router();

kushkiPaymentsRouter.post('/charge-order', kushkiPaymentsController.chargeOrder);
kushkiPaymentsRouter.post(
  '/complete-tokenize',
  authenticate,
  kushkiPaymentsController.completeTokenize,
);
