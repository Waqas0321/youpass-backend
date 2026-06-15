import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { waitlistController } from './waitlist.controller.js';

export const eventWaitlistRouter = Router({ mergeParams: true });

eventWaitlistRouter.use(authenticate);

eventWaitlistRouter.get('/preview', waitlistController.getJoinPreview);
eventWaitlistRouter.post('/join', waitlistController.join);
eventWaitlistRouter.delete('/leave', waitlistController.leave);
eventWaitlistRouter.get('/position', waitlistController.getPosition);

export const waitlistOffersRouter = Router();

waitlistOffersRouter.use(authenticate);
waitlistOffersRouter.post('/:id/claim', waitlistController.claimOffer);
