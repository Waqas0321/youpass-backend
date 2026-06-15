import { Router } from 'express';
import { producerInvitationsController } from './producer-invitations.controller.js';

export const producerInvitationsRouter = Router();

producerInvitationsRouter.get('/', producerInvitationsController.list);
producerInvitationsRouter.post('/', producerInvitationsController.create);
producerInvitationsRouter.get('/stats', producerInvitationsController.stats);
producerInvitationsRouter.get('/alerts', producerInvitationsController.alerts);
producerInvitationsRouter.get('/freed-slots', producerInvitationsController.freedSlots);
producerInvitationsRouter.post('/reinvite', producerInvitationsController.reinvite);
producerInvitationsRouter.get(
  '/suggested-candidates',
  producerInvitationsController.suggestedCandidates,
);
producerInvitationsRouter.get('/post-event-report', producerInvitationsController.postEventReport);
producerInvitationsRouter.get('/waitlist', producerInvitationsController.waitlistDashboard);

export const producerEventsRouter = Router();

producerEventsRouter.patch(
  '/:id/invitation-settings',
  producerInvitationsController.updateEventInvitationSettings,
);
