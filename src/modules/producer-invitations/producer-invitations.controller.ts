import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { resolveProducerId } from '../../common/middleware/dashboard-auth.js';
import { producerInvitationsService } from './producer-invitations.service.js';
import { waitlistService } from '../waitlist/waitlist.service.js';
import {
  createProducerInvitationSchema,
  listProducerInvitationsQuerySchema,
  postEventReportQuerySchema,
  reinviteProducerInvitationSchema,
  suggestedCandidatesQuerySchema,
  updateEventInvitationSettingsSchema,
} from './producer-invitations.validators.js';

export const producerInvitationsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const query = listProducerInvitationsQuerySchema.parse(req.query);
      const data = await producerInvitationsService.listInvitations(producerId, query);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const body = createProducerInvitationSchema.parse(req.body);
      const data = await producerInvitationsService.createInvitation(producerId, body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const data = await producerInvitationsService.getStats(producerId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  alerts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const data = await producerInvitationsService.getAlerts(producerId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  freedSlots: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const data = await producerInvitationsService.listFreedSlots(producerId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  reinvite: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const body = reinviteProducerInvitationSchema.parse(req.body);
      const data = await producerInvitationsService.reinvite(producerId, body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  suggestedCandidates: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const query = suggestedCandidatesQuerySchema.parse(req.query);
      const data = await producerInvitationsService.getSuggestedCandidates(
        producerId,
        query.event_id,
        query.limit,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  postEventReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const query = postEventReportQuerySchema.parse(req.query);
      const data = await producerInvitationsService.getPostEventReport(
        producerId,
        query.event_id,
        query.format,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  updateEventInvitationSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const body = updateEventInvitationSettingsSchema.parse(req.body);
      const data = await producerInvitationsService.updateEventInvitationSettings(
        producerId,
        String(req.params.id),
        body,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  waitlistDashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const producerId = resolveProducerId(req);
      const data = await waitlistService.getProducerWaitlistDashboard(
        producerId,
        String(req.query.event_id),
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
