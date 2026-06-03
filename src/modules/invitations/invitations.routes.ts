import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { invitationsController } from './invitations.controller.js';

export const invitationsRouter = Router();

invitationsRouter.use(authenticate);

invitationsRouter.get('/', invitationsController.list);
invitationsRouter.get('/:id/ticket', invitationsController.ticket);
invitationsRouter.get('/:id', invitationsController.getById);
invitationsRouter.post('/:id/confirm', invitationsController.confirm);
invitationsRouter.post('/:id/reject', invitationsController.reject);
