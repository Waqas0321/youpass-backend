import { Router } from 'express';
import { requireAdminApiKey } from '../../common/middleware/admin-api-key.js';
import { adminController } from './admin.controller.js';
import { adminVenueLayoutController } from './admin-venue-layout.controller.js';
import { adminEventDrinksController } from './admin-event-drinks.controller.js';
import { adminEventDrinkOrdersController } from './admin-event-drink-orders.controller.js';
import { adminUploadController } from './admin-upload.controller.js';
import { uploadAdminImage } from '../../common/middleware/upload-admin-image.js';
import { venuesController } from '../venues/venues.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAdminApiKey);

adminRouter.post('/uploads/image', uploadAdminImage, adminUploadController.uploadImage);

adminRouter.get('/overview', adminController.overview);
adminRouter.get('/twilio/whatsapp-diagnostics', adminController.twilioWhatsAppDiagnostics);
adminRouter.post('/twilio/submit-otp-template-approval', adminController.submitTwilioOtpTemplateApproval);
adminRouter.get('/producers', adminController.listProducers);
adminRouter.post('/producers', adminController.createProducer);
adminRouter.patch('/producers/:producerId', adminController.updateProducer);
adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/events', adminController.listEvents);
adminRouter.post('/events', adminController.createEvent);
adminRouter.patch('/events/:eventId', adminController.updateEvent);
adminRouter.delete('/events/:eventId', adminController.deleteEvent);
adminRouter.get('/venues', venuesController.list);
adminRouter.post('/venues', venuesController.create);
adminRouter.get('/venues/:id', venuesController.getById);
adminRouter.patch('/venues/:id', venuesController.update);
adminRouter.delete('/venues/:id', venuesController.remove);
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
adminRouter.get(
  '/events/:eventId/drink-categories',
  adminEventDrinksController.listCategories,
);
adminRouter.post(
  '/events/:eventId/drink-categories',
  adminEventDrinksController.createCategory,
);
adminRouter.get(
  '/events/:eventId/drink-products',
  adminEventDrinksController.listProducts,
);
adminRouter.post(
  '/events/:eventId/drink-products',
  adminEventDrinksController.createProduct,
);
adminRouter.patch(
  '/events/:eventId/drink-products/:productId',
  adminEventDrinksController.updateProduct,
);
adminRouter.post(
  '/events/:eventId/drink-products/:productId/duplicate',
  adminEventDrinksController.duplicateProduct,
);
adminRouter.delete(
  '/events/:eventId/drink-products/:productId',
  adminEventDrinksController.deleteProduct,
);
adminRouter.get(
  '/events/:eventId/drink-orders',
  adminEventDrinkOrdersController.list,
);
adminRouter.get(
  '/events/:eventId/drink-orders/export',
  adminEventDrinkOrdersController.exportCsv,
);
adminRouter.get(
  '/events/:eventId/drink-orders/:orderId',
  adminEventDrinkOrdersController.get,
);
adminRouter.post(
  '/events/:eventId/drink-orders/:orderId/reissue-qr',
  adminEventDrinkOrdersController.reissueQr,
);
adminRouter.post(
  '/events/:eventId/drink-orders/:orderId/refund',
  adminEventDrinkOrdersController.refund,
);
adminRouter.post(
  '/events/:eventId/drink-orders/:orderId/invalidate',
  adminEventDrinkOrdersController.invalidate,
);
