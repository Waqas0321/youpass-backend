import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { ticketsController } from './tickets.controller.js';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

ticketsRouter.get('/upcoming', ticketsController.listUpcoming);
ticketsRouter.get('/past', ticketsController.listPast);
ticketsRouter.get('/yearly-summary', ticketsController.yearlySummary);
ticketsRouter.get('/:id/qr', ticketsController.getQr);
ticketsRouter.get('/:id', ticketsController.getById);
