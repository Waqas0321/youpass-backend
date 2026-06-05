import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { ticketOrdersController } from './ticket-orders.controller.js';

export const ticketOrdersRouter = Router();

ticketOrdersRouter.use(authenticate);

ticketOrdersRouter.get('/:orderId/assignments', ticketOrdersController.listAssignments);
ticketOrdersRouter.post('/:orderId/slots/:slotId/assign', ticketOrdersController.assignSlot);
ticketOrdersRouter.delete('/:orderId/slots/:slotId/assign', ticketOrdersController.cancelAssignment);
ticketOrdersRouter.post('/:orderId/slots/:slotId/resend', ticketOrdersController.resendAssignment);
