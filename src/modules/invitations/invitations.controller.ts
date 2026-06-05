import type { Request, Response, NextFunction } from 'express';
import { invitationsService, paymentMethodsService } from './invitations.service.js';
import { successResponse } from '../../common/utils/crypto.js';
import {
  confirmInvitationSchema,
  listInvitationsQuerySchema,
  rejectInvitationSchema,
  savePaymentMethodSchema,
} from './invitations.validators.js';

export const invitationsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listInvitationsQuerySchema.parse(req.query);
      const data = await invitationsService.listInvitations(req.user!.id, req.user!.phone, query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invitationsService.getInvitationDetail(
        req.user!.id,
        req.user!.phone,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  summary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invitationsService.getSummary(req.user!.id, req.user!.phone);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  claimPreview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invitationsService.getClaimPreview(String(req.params.token));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  confirm: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = confirmInvitationSchema.parse(req.body ?? {});
      const data = await invitationsService.confirmInvitation(
        req.user!.id,
        req.user!.phone,
        String(req.params.id),
        body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      rejectInvitationSchema.parse(req.body ?? {});
      const data = await invitationsService.rejectInvitation(
        req.user!.id,
        req.user!.phone,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  ticket: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invitationsService.getTicket(
        req.user!.id,
        req.user!.phone,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};

export const paymentMethodsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentMethodsService.listPaymentMethods(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  save: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = savePaymentMethodSchema.parse(req.body);
      const data = await paymentMethodsService.savePaymentMethod(req.user!.id, body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
