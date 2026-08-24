import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { authenticateStaff } from '../../common/middleware/authenticate-staff.js';
import { requireStaffPermission } from '../../common/middleware/require-staff-permission.js';
import { staffScanController } from './staff-scan.controller.js';
import { staffScanQrSchema, staffScanRecentQuerySchema } from './staff-scan.validators.js';

export const staffScanRouter = Router();

staffScanRouter.get(
  '/recent',
  authenticateStaff,
  validate(staffScanRecentQuerySchema, 'query'),
  staffScanController.listRecent,
);

staffScanRouter.get(
  '/active-events',
  authenticateStaff,
  requireStaffPermission('scan_tickets', 'tickets_supervisor', 'general_admin'),
  staffScanController.listActiveEvents,
);

staffScanRouter.post(
  '/entry',
  authenticateStaff,
  requireStaffPermission('scan_tickets', 'tickets_supervisor', 'general_admin'),
  validate(staffScanQrSchema),
  staffScanController.scanEntry,
);

staffScanRouter.post(
  '/product',
  authenticateStaff,
  requireStaffPermission('scan_products', 'bar_supervisor', 'general_admin'),
  validate(staffScanQrSchema),
  staffScanController.scanProduct,
);
