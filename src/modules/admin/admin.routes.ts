import { Router } from 'express';
import { requireAdminApiKey } from '../../common/middleware/admin-api-key.js';
import { adminController } from './admin.controller.js';
import { adminVenueLayoutController } from './admin-venue-layout.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAdminApiKey);

adminRouter.get('/overview', adminController.overview);
adminRouter.get('/producers', adminController.listProducers);
adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/events', adminController.listEvents);
adminRouter.post('/events', adminController.createEvent);
adminRouter.patch('/events/:eventId', adminController.updateEvent);
adminRouter.delete('/events/:eventId', adminController.deleteEvent);
adminRouter.get('/events/:eventId/invitation-settings', adminController.getEventInvitationSettings);
adminRouter.patch('/events/:eventId/invitation-settings', adminController.updateEventInvitationSettings);
adminRouter.get('/events/:eventId/waitlist', adminController.getEventWaitlist);
adminRouter.get('/events/:eventId/ticket-offerings', adminController.listEventTicketOfferings);
adminRouter.post('/events/:eventId/ticket-offerings', adminController.createEventTicketOffering);
adminRouter.patch(
  '/events/:eventId/ticket-offerings/:offeringId',
  adminController.updateEventTicketOffering,
);
adminRouter.delete(
  '/events/:eventId/ticket-offerings/:offeringId',
  adminController.deleteEventTicketOffering,
);
adminRouter.get('/events/:eventId/venue-layout', adminVenueLayoutController.getEventVenueLayout);
adminRouter.put('/events/:eventId/venue-layout', adminVenueLayoutController.upsertEventVenueLayout);
adminRouter.delete('/events/:eventId/venue-layout', adminVenueLayoutController.deleteEventVenueLayout);
adminRouter.post('/events/:eventId/venue-layout/zones', adminVenueLayoutController.createVenueZone);
adminRouter.patch(
  '/events/:eventId/venue-layout/zones/:zoneId',
  adminVenueLayoutController.updateVenueZone,
);
adminRouter.delete(
  '/events/:eventId/venue-layout/zones/:zoneId',
  adminVenueLayoutController.deleteVenueZone,
);
adminRouter.post(
  '/events/:eventId/venue-layout/zones/:zoneId/tables',
  adminVenueLayoutController.createVenueTable,
);
adminRouter.patch(
  '/events/:eventId/venue-layout/zones/:zoneId/tables/:tableId',
  adminVenueLayoutController.updateVenueTable,
);
adminRouter.delete(
  '/events/:eventId/venue-layout/zones/:zoneId/tables/:tableId',
  adminVenueLayoutController.deleteVenueTable,
);
