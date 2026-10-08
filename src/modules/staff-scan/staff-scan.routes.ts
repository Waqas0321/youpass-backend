import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { authenticateStaff } from '../../common/middleware/authenticate-staff.js';
import { requireStaffPermission } from '../../common/middleware/require-staff-permission.js';
import { staffScanController } from './staff-scan.controller.js';
import {
  staffScanQrSchema,
  staffScanRecentQuerySchema,
  staffScanSyncSchema,
} from './staff-scan.validators.js';

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

/** M10 — batch sync of HMAC-signed offline scans. */
staffScanRouter.post(
  '/sync',
  authenticateStaff,
  requireStaffPermission(
    'scan_tickets',
    'scan_products',
    'tickets_supervisor',
    'bar_supervisor',
    'general_admin',
  ),
  validate(staffScanSyncSchema),
  staffScanController.syncOffline,
);
