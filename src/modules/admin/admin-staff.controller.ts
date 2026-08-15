import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import {
  adminCreateStaffRoleSchema,
  adminCreateStaffSchema,
  adminCreateStaffZoneSchema,
  adminUpdateStaffSchema,
} from './admin-staff.validators.js';
import { adminStaffService } from './admin-staff.service.js';

export const adminStaffController = {
  listStaff: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = await adminStaffService.listAll();
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  createStaff: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminCreateStaffSchema.parse(req.body);
      const staff = await adminStaffService.createMember(body);
      res.status(201).json(successResponse(staff));
    } catch (err) {
      next(err);
    }
  },

  updateStaff: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffId = String(req.params.staffId);
      const body = adminUpdateStaffSchema.parse(req.body);
      const staff = await adminStaffService.updateMember(staffId, body);
      res.json(successResponse(staff));
    } catch (err) {
      next(err);
    }
  },

  getSupervisorPin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffId = String(req.params.staffId);
      const payload = await adminStaffService.getSupervisorPin(staffId);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  resetSupervisorPin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffId = String(req.params.staffId);
      const payload = await adminStaffService.resetSupervisorPin(staffId);
      res.json(successResponse(payload));
    } catch (err) {
      next(err);
    }
  },

  resetStaffQr: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffId = String(req.params.staffId);
      const staff = await adminStaffService.resetMemberQr(staffId);
      res.json(successResponse(staff));
    } catch (err) {
      next(err);
    }
  },

  getStaffQr: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffId = String(req.params.staffId);
      const staff = await adminStaffService.getMemberQr(staffId);
      res.json(successResponse(staff));
    } catch (err) {
      next(err);
    }
  },

  deleteStaff: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffId = String(req.params.staffId);
      const result = await adminStaffService.deleteMember(staffId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },

  createRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminCreateStaffRoleSchema.parse(req.body);
      const role = await adminStaffService.createRole(body);
      res.status(201).json(successResponse(role));
    } catch (err) {
      next(err);
    }
  },

  createZone: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminCreateStaffZoneSchema.parse(req.body);
      const zone = await adminStaffService.createZone(body);
      res.status(201).json(successResponse(zone));
    } catch (err) {
      next(err);
    }
  },
};
