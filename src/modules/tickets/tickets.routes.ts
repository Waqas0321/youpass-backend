import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { ticketsController } from './tickets.controller.js';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

ticketsRouter.get('/upcoming', ticketsController.listUpcoming);
ticketsRouter.get('/past', ticketsController.listPast);
ticketsRouter.get('/yearly-summary', ticketsController.yearlySummary);
ticketsRouter.post('/:id/cancel', ticketsController.cancelTicket);
ticketsRouter.get('/:id/assignments', ticketsController.listAssignments);
ticketsRouter.post('/:id/slots/:slotId/assign', ticketsController.assignSlot);
ticketsRouter.delete('/:id/slots/:slotId/assign', ticketsController.cancelAssignment);
ticketsRouter.post('/:id/slots/:slotId/resend', ticketsController.resendAssignment);
ticketsRouter.get('/:id/qr', ticketsController.getQr);
ticketsRouter.get('/:id', ticketsController.getById);
