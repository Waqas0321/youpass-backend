import { Router } from 'express';
import { requireAdminApiKey } from '../../common/middleware/admin-api-key.js';
import { adminController } from './admin.controller.js';
import { adminVenueLayoutController } from './admin-venue-layout.controller.js';
import { adminEventDrinksController } from './admin-event-drinks.controller.js';
import { adminEventDrinkOrdersController } from './admin-event-drink-orders.controller.js';
import { adminEventDashboardController } from './admin-event-dashboard.controller.js';
import { adminEventSalesController } from './admin-event-sales.controller.js';
import { adminEventStaffQrController } from './admin-event-staff-qr.controller.js';
import { adminEventVipTablesController } from './admin-event-vip-tables.controller.js';
import { adminStaffController } from './admin-staff.controller.js';
import { adminUploadController } from './admin-upload.controller.js';
import { uploadAdminImage } from '../../common/middleware/upload-admin-image.js';
import { uploadAdminVideo } from '../../common/middleware/upload-admin-video.js';
import { venuesController } from '../venues/venues.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAdminApiKey);

adminRouter.post('/uploads/image', uploadAdminImage, adminUploadController.uploadImage);
adminRouter.post('/uploads/video', uploadAdminVideo, adminUploadController.uploadVideo);

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
adminRouter.get('/events/:eventId/dashboard', adminEventDashboardController.get);
adminRouter.get(
  '/events/:eventId/dashboard/hourly-ticket-sales',
  adminEventDashboardController.getHourlyTicketSales,
);
adminRouter.get('/events/:eventId/dashboard/panels', adminEventDashboardController.getPanels);
adminRouter.get('/events/:eventId/sales', adminEventSalesController.get);
adminRouter.patch('/events/:eventId/sales', adminEventSalesController.update);
adminRouter.get('/events/:eventId/staff-qr', adminEventStaffQrController.get);
adminRouter.get('/events/:eventId/staff-qr/scans', adminEventStaffQrController.listScans);
adminRouter.get('/staff', adminStaffController.listStaff);
adminRouter.post('/staff', adminStaffController.createStaff);
adminRouter.post('/staff/roles', adminStaffController.createRole);
adminRouter.post('/staff/zones', adminStaffController.createZone);
adminRouter.patch('/staff/:staffId', adminStaffController.updateStaff);
adminRouter.post('/staff/:staffId/reset-qr', adminStaffController.resetStaffQr);
adminRouter.get('/staff/:staffId/supervisor-pin', adminStaffController.getSupervisorPin);
adminRouter.post('/staff/:staffId/reset-supervisor-pin', adminStaffController.resetSupervisorPin);
adminRouter.get('/staff/:staffId/qr', adminStaffController.getStaffQr);
adminRouter.delete('/staff/:staffId', adminStaffController.deleteStaff);
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
adminRouter.get('/events/:eventId/vip-tables', adminEventVipTablesController.list);
adminRouter.post('/events/:eventId/vip-tables/ensure-layout', adminEventVipTablesController.ensureLayout);
adminRouter.get(
  '/events/:eventId/vip-tables/:tableId/guests',
  adminEventVipTablesController.listGuests,
);
adminRouter.post(
  '/events/:eventId/vip-tables/:tableId/actions',
  adminEventVipTablesController.applyAction,
);
adminRouter.post(
  '/events/:eventId/vip-tables/:tableId/move',
  adminEventVipTablesController.moveTable,
);
adminRouter.patch(
  '/events/:eventId/vip-tables/:tableId',
  adminEventVipTablesController.editTable,
);
adminRouter.delete(
  '/events/:eventId/vip-tables/:tableId/guests/:slotId',
  adminEventVipTablesController.cancelGuest,
);
adminRouter.get(
  '/events/:eventId/drink-categories',
  adminEventDrinksController.listCategories,
);
adminRouter.post(
  '/events/:eventId/drink-categories',
  adminEventDrinksController.createCategory,
);
adminRouter.patch(
  '/events/:eventId/drink-categories/:categoryId',
  adminEventDrinksController.updateCategory,
);
adminRouter.delete(
  '/events/:eventId/drink-categories/:categoryId',
  adminEventDrinksController.deleteCategory,
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
