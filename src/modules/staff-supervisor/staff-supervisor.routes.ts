import { Router } from 'express';
import { authenticateStaff } from '../../common/middleware/authenticate-staff.js';
import { requireStaffPermission } from '../../common/middleware/require-staff-permission.js';
import { validate } from '../../common/middleware/validate.js';
import { staffSupervisorController } from './staff-supervisor.controller.js';
import {
  staffSupervisorEntryCodeParamsSchema,
  staffSupervisorEntryTicketParamsSchema,
  staffSupervisorApplyEntryManualValidationSchema,
  staffSupervisorApplyEntryOverrideSchema,
  staffSupervisorResolveDuplicateSchema,
  staffSupervisorSearchEntriesQuerySchema,
  staffSupervisorValidatePinSchema,
  staffSupervisorApplyVipTableActionSchema,
  staffSupervisorSearchVipTablesQuerySchema,
  staffSupervisorVipTableOrderParamsSchema,
  staffSupervisorSystemStatusQuerySchema,
  staffSupervisorApplySystemStatusActionSchema,
  staffSupervisorActionHistoryQuerySchema,
} from './staff-supervisor.validators.js';
import {
  staffSupervisorDrinkRedemptionParamsSchema,
  staffSupervisorSearchDrinksQuerySchema,
  staffSupervisorApplyDrinkCancellationSchema,
  staffSupervisorApplyDrinkManualValidationSchema,
  staffSupervisorApplyDrinkOverrideSchema,
  staffSupervisorDrinkActionHistoryQuerySchema,
} from './drinks/staff-supervisor-drink.validators.js';

export const staffSupervisorRouter = Router();

staffSupervisorRouter.post(
  '/validate-pin',
  authenticateStaff,
  validate(staffSupervisorValidatePinSchema),
  staffSupervisorController.validatePin,
);

staffSupervisorRouter.get(
  '/entries/search',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorSearchEntriesQuerySchema, 'query'),
  staffSupervisorController.searchEntries,
);

staffSupervisorRouter.get(
  '/drinks/search',
  authenticateStaff,
  requireStaffPermission('bar_supervisor', 'general_admin'),
  validate(staffSupervisorSearchDrinksQuerySchema, 'query'),
  staffSupervisorController.searchDrinks,
);

staffSupervisorRouter.get(
  '/drinks/action-history',
  authenticateStaff,
  requireStaffPermission('bar_supervisor', 'general_admin'),
  validate(staffSupervisorDrinkActionHistoryQuerySchema, 'query'),
  staffSupervisorController.getDrinkActionHistory,
);

staffSupervisorRouter.get(
  '/drinks/:redemptionId',
  authenticateStaff,
  requireStaffPermission('bar_supervisor', 'general_admin'),
  validate(staffSupervisorDrinkRedemptionParamsSchema, 'params'),
  staffSupervisorController.getDrinkDetail,
);

staffSupervisorRouter.post(
  '/drinks/:redemptionId/cancellations',
  authenticateStaff,
  requireStaffPermission('bar_supervisor', 'general_admin'),
  validate(staffSupervisorDrinkRedemptionParamsSchema, 'params'),
  validate(staffSupervisorApplyDrinkCancellationSchema),
  staffSupervisorController.applyDrinkCancellation,
);

staffSupervisorRouter.post(
  '/drinks/:redemptionId/manual-validation',
  authenticateStaff,
  requireStaffPermission('bar_supervisor', 'general_admin'),
  validate(staffSupervisorDrinkRedemptionParamsSchema, 'params'),
  validate(staffSupervisorApplyDrinkManualValidationSchema),
  staffSupervisorController.applyDrinkManualValidation,
);

staffSupervisorRouter.post(
  '/drinks/:redemptionId/override',
  authenticateStaff,
  requireStaffPermission('bar_supervisor', 'general_admin'),
  validate(staffSupervisorDrinkRedemptionParamsSchema, 'params'),
  validate(staffSupervisorApplyDrinkOverrideSchema),
  staffSupervisorController.applyDrinkOverride,
);

staffSupervisorRouter.get(
  '/vip-tables/search',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorSearchVipTablesQuerySchema, 'query'),
  staffSupervisorController.searchVipTables,
);

staffSupervisorRouter.get(
  '/vip-tables/:orderId',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorVipTableOrderParamsSchema, 'params'),
  staffSupervisorController.getVipTableContext,
);

staffSupervisorRouter.post(
  '/vip-tables/:orderId/actions',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorVipTableOrderParamsSchema, 'params'),
  validate(staffSupervisorApplyVipTableActionSchema),
  staffSupervisorController.applyVipTableAction,
);

staffSupervisorRouter.get(
  '/system-status',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorSystemStatusQuerySchema, 'query'),
  staffSupervisorController.getSystemStatus,
);

staffSupervisorRouter.post(
  '/system-status/actions',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorApplySystemStatusActionSchema),
  staffSupervisorController.applySystemStatusAction,
);

staffSupervisorRouter.get(
  '/action-history',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorActionHistoryQuerySchema, 'query'),
  staffSupervisorController.getActionHistory,
);

staffSupervisorRouter.get(
  '/entries/by-entry/:entryCode/manual-validation',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryCodeParamsSchema, 'params'),
  staffSupervisorController.getEntryManualValidationContextByEntryCode,
);

staffSupervisorRouter.post(
  '/entries/by-entry/:entryCode/manual-validation',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryCodeParamsSchema, 'params'),
  validate(staffSupervisorApplyEntryManualValidationSchema),
  staffSupervisorController.applyEntryManualValidationByEntryCode,
);

staffSupervisorRouter.get(
  '/entries/by-entry/:entryCode/override',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryCodeParamsSchema, 'params'),
  staffSupervisorController.getEntryOverrideContextByEntryCode,
);

staffSupervisorRouter.post(
  '/entries/by-entry/:entryCode/override',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryCodeParamsSchema, 'params'),
  validate(staffSupervisorApplyEntryOverrideSchema),
  staffSupervisorController.applyEntryOverrideByEntryCode,
);

staffSupervisorRouter.get(
  '/entries/by-entry/:entryCode/duplicate',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryCodeParamsSchema, 'params'),
  staffSupervisorController.getDuplicateAlertByEntryCode,
);

staffSupervisorRouter.post(
  '/entries/by-entry/:entryCode/resolve-duplicate',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryCodeParamsSchema, 'params'),
  validate(staffSupervisorResolveDuplicateSchema),
  staffSupervisorController.resolveDuplicateByEntryCode,
);

staffSupervisorRouter.get(
  '/entries/:ticketId/history',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  staffSupervisorController.getEntryHistory,
);

staffSupervisorRouter.get(
  '/entries/:ticketId/duplicate',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  staffSupervisorController.getDuplicateAlert,
);

staffSupervisorRouter.post(
  '/entries/:ticketId/resolve-duplicate',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  validate(staffSupervisorResolveDuplicateSchema),
  staffSupervisorController.resolveDuplicate,
);

staffSupervisorRouter.get(
  '/entries/:ticketId/override',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  staffSupervisorController.getEntryOverrideContext,
);

staffSupervisorRouter.post(
  '/entries/:ticketId/override',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  validate(staffSupervisorApplyEntryOverrideSchema),
  staffSupervisorController.applyEntryOverride,
);

staffSupervisorRouter.get(
  '/entries/:ticketId/manual-validation',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  staffSupervisorController.getEntryManualValidationContext,
);

staffSupervisorRouter.post(
  '/entries/:ticketId/manual-validation',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  validate(staffSupervisorApplyEntryManualValidationSchema),
  staffSupervisorController.applyEntryManualValidation,
);

staffSupervisorRouter.get(
  '/entries/:ticketId',
  authenticateStaff,
  requireStaffPermission('tickets_supervisor', 'general_admin'),
  validate(staffSupervisorEntryTicketParamsSchema, 'params'),
  staffSupervisorController.getEntryDetail,
);
