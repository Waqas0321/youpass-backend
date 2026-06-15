import type { Request, Response, NextFunction } from 'express';
import { invitationsService, paymentMethodsService } from './invitations.service.js';
import { successResponse } from '../../common/utils/crypto.js';
import {
  acceptInvitationSchema,
  confirmInvitationSchema,
  listInvitationsQuerySchema,
  rejectInvitationSchema,
  savePaymentMethodSchema,
  cancelInvitationSchema,
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

  getStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invitationsService.getInvitationStatus(
        req.user!.id,
        req.user!.phone,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  accept: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = acceptInvitationSchema.parse(req.body ?? {});
      const data = await invitationsService.acceptInvitation(
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

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      cancelInvitationSchema.parse(req.body ?? {});
      const data = await invitationsService.cancelInvitation(
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

  listWallet: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentMethodsService.listWalletCards(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentMethodsService.getWalletBalance(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listTransactions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentMethodsService.listWalletTransactions(req.user!.id);
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

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentMethodsService.deletePaymentMethod(
        req.user!.id,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  setDefault: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentMethodsService.setDefaultPaymentMethod(
        req.user!.id,
        String(req.params.id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  createTokenizeSession: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiOrigin = `${req.protocol}://${req.get('host')}`;
      const data = await paymentMethodsService.createWalletTokenizeSession(
        req.user!.id,
        apiOrigin,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
