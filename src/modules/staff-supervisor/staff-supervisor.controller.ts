import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { staffSupervisorService } from './staff-supervisor.service.js';
import type { StaffSupervisorSearchEntriesQuery } from './staff-supervisor.validators.js';
import type { StaffSupervisorSearchDrinksQuery } from './drinks/staff-supervisor-drink.validators.js';

export const staffSupervisorController = {
  validatePin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffSupervisorService.validatePin(
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  searchEntries: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as StaffSupervisorSearchEntriesQuery;
      const data = await staffSupervisorService.searchEntries(query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  searchDrinks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as StaffSupervisorSearchDrinksQuery;
      const data = await staffSupervisorService.searchDrinks(query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getDrinkDetail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { redemptionId } = req.validatedParams as { redemptionId: string };
      const data = await staffSupervisorService.getDrinkDetail(redemptionId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEntryDetail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.getEntryDetail(ticketId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEntryHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.getEntryHistory(ticketId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getDuplicateAlert: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.getDuplicateAlert(ticketId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getDuplicateAlertByEntryCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entryCode } = req.validatedParams as { entryCode: string };
      const data = await staffSupervisorService.getDuplicateAlertByEntryCode(entryCode);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  resolveDuplicate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.resolveDuplicate(
        ticketId,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  resolveDuplicateByEntryCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entryCode } = req.validatedParams as { entryCode: string };
      const data = await staffSupervisorService.resolveDuplicateByEntryCode(
        entryCode,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEntryOverrideContext: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.getEntryOverrideContext(ticketId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEntryOverrideContextByEntryCode: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { entryCode } = req.validatedParams as { entryCode: string };
      const data = await staffSupervisorService.getEntryOverrideContextByEntryCode(entryCode);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyEntryOverride: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.applyEntryOverride(
        ticketId,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyEntryOverrideByEntryCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entryCode } = req.validatedParams as { entryCode: string };
      const data = await staffSupervisorService.applyEntryOverrideByEntryCode(
        entryCode,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEntryManualValidationContext: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.getEntryManualValidationContext(ticketId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEntryManualValidationContextByEntryCode: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { entryCode } = req.validatedParams as { entryCode: string };
      const data =
        await staffSupervisorService.getEntryManualValidationContextByEntryCode(entryCode);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyEntryManualValidation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.validatedParams as { ticketId: string };
      const data = await staffSupervisorService.applyEntryManualValidation(
        ticketId,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyEntryManualValidationByEntryCode: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { entryCode } = req.validatedParams as { entryCode: string };
      const data = await staffSupervisorService.applyEntryManualValidationByEntryCode(
        entryCode,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  searchVipTables: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.validatedQuery as { q: string };
      const data = await staffSupervisorService.searchVipTables(q);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getVipTableContext: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.validatedParams as { orderId: string };
      const data = await staffSupervisorService.getVipTableContext(orderId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyVipTableAction: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.validatedParams as { orderId: string };
      const data = await staffSupervisorService.applyVipTableAction(
        orderId,
        req.staffMember!.id,
        req.staffMember!.name?.trim() || 'Supervisor',
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getSystemStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as { event_id?: string };
      const data = await staffSupervisorService.getSystemStatus(query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applySystemStatusAction: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffSupervisorService.applySystemStatusAction(
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getActionHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as { event_id?: string; limit?: number };
      const data = await staffSupervisorService.getActionHistory(query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getDrinkActionHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as { event_id?: string; limit?: number };
      const data = await staffSupervisorService.getDrinkActionHistory(query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyDrinkCancellation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { redemptionId } = req.validatedParams as { redemptionId: string };
      const data = await staffSupervisorService.applyDrinkCancellation(
        redemptionId,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyDrinkManualValidation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { redemptionId } = req.validatedParams as { redemptionId: string };
      const data = await staffSupervisorService.applyDrinkManualValidation(
        redemptionId,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  applyDrinkOverride: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { redemptionId } = req.validatedParams as { redemptionId: string };
      const data = await staffSupervisorService.applyDrinkOverride(
        redemptionId,
        req.staffMember!.id,
        req.body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
