import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { successResponse } from '../../common/utils/crypto.js';
import { invitationSettingsService } from '../invitations/invitation-settings.service.js';
import {
  formatInvitationSettingsResponse,
  invitationSettingsUpdateData,
} from '../invitations/invitation-settings.formatter.js';
import { INVITATION_SETTINGS_DEFAULTS } from '../invitations/invitation-settings.service.js';
import { updateEventInvitationSettingsSchema } from '../producer-invitations/producer-invitations.validators.js';
import { waitlistService } from '../waitlist/waitlist.service.js';
import { eventsService } from '../events/events.service.js';
import { createEventSchema, updateEventSchema } from '../events/events.validators.js';
import { formatEvent } from '../events/events.formatter.js';
import { getCountrySync } from '../../common/services/country-config.service.js';
import { getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { formatAdminTicketOffering } from '../ticket-offerings/ticket-offering.formatter.js';
import {
  normalizeStatusAfterStockChange,
  resolveOfferingRef,
} from '../ticket-offerings/ticket-offering.types.js';
import {
  adminTicketOfferingSchema,
  adminTicketOfferingUpdateSchema,
} from './admin-ticket-offerings.validators.js';

export const adminController = {
  overview: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        producers,
        events,
        invitations,
        pendingInvitations,
        users,
        banners,
        categories,
        waitlistWaiting,
        activeOffers,
      ] = await Promise.all([
        prisma.producer.count(),
        prisma.event.count({ where: { status: 'published' } }),
        prisma.invitation.count(),
        prisma.invitation.count({ where: { status: { in: ['sent', 'viewed'] } } }),
        prisma.user.count({ where: { accountStatus: 'active' } }),
        prisma.homeBannerSlide.count(),
        prisma.eventType.count({ where: { isActive: true } }),
        prisma.waitlistEntry.count({ where: { status: 'waiting' } }),
        prisma.waitlistOffer.count({ where: { status: 'active' } }),
      ]);

      res.json(
        successResponse({
          producers,
          published_events: events,
          invitations_total: invitations,
          invitations_pending: pendingInvitations,
          active_users: users,
          home_banners: banners,
          active_categories: categories,
          waitlist_waiting: waitlistWaiting,
          waitlist_active_offers: activeOffers,
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  listProducers: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const producers = await prisma.producer.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          followerCount: true,
          createdAt: true,
        },
      });

      res.json(
        successResponse({
          producers: producers.map((producer) => ({
            id: producer.id,
            name: producer.name,
            logo_url: producer.logoUrl,
            follower_count: producer.followerCount,
            created_at: producer.createdAt.toISOString(),
          })),
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  listUsers: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        where: { accountStatus: 'active' },
        orderBy: { fullName: 'asc' },
        take: 200,
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
        },
      });

      res.json(
        successResponse({
          users: users.map((user) => ({
            id: user.id,
            full_name: user.fullName,
            phone: user.phone,
            email: user.email,
          })),
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  listEvents: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await prisma.event.findMany({
        orderBy: { startsAt: 'desc' },
        take: 200,
        include: { eventType: true, venue: true },
      });

      res.json(
        successResponse({
          events: events.map((event) => {
            const country = getCountrySync(event.countryCode);
            const formatted = formatEvent(event, false, {
              timezone: country?.timezone,
              languageCode: country?.languageCode,
            });

            return {
              ...formatted,
              description: event.description,
              producer_name: event.producerName,
            };
          }),
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  createEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createEventSchema.parse(req.body);
      const data = await eventsService.createEvent(body);
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  updateEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = updateEventSchema.parse(req.body);
      const data = await eventsService.updateEvent(eventId, body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const data = await eventsService.deleteEvent(eventId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEventInvitationSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const settings = await invitationSettingsService.getInvitationSettings(eventId);
      res.json(successResponse(formatInvitationSettingsResponse(settings)));
    } catch (err) {
      next(err);
    }
  },

  updateEventInvitationSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = updateEventInvitationSettingsSchema.parse(req.body);
      const settings = await prisma.invitationSettings.upsert({
        where: { eventId },
        create: {
          eventId,
          ...invitationSettingsUpdateData(body, INVITATION_SETTINGS_DEFAULTS),
        },
        update: invitationSettingsUpdateData(body, INVITATION_SETTINGS_DEFAULTS),
      });

      res.json(successResponse(formatInvitationSettingsResponse(settings)));
    } catch (err) {
      next(err);
    }
  },

  getEventWaitlist: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const data = await waitlistService.getProducerWaitlistDashboard('', eventId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listEventTicketOfferings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
      }

      const currencyMeta = getEventCurrencyMeta(event.countryCode);
      const offerings = await prisma.eventTicketOffering.findMany({
        where: { eventId },
        orderBy: { displayOrder: 'asc' },
      });
      const now = new Date();

      res.json(
        successResponse({
          event_id: eventId,
          offerings: offerings.map((offering) =>
            formatAdminTicketOffering(offering, currencyMeta.currency, now),
          ),
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  createEventTicketOffering: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const body = adminTicketOfferingSchema.parse(req.body);
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
      }

      const currencyMeta = getEventCurrencyMeta(event.countryCode);
      const stockTotal = body.stock_total ?? null;
      const stockRemaining =
        body.stock_remaining ?? (stockTotal != null ? stockTotal : null);
      const status =
        body.status ??
        (stockRemaining != null && stockRemaining <= 0 ? 'sold_out' : 'active');

      const offering = await prisma.eventTicketOffering.create({
        data: {
          eventId,
          type: body.type,
          name: body.name.trim(),
          price: body.price,
          currency: currencyMeta.currency,
          stockTotal,
          stockRemaining,
          saleStartAt: body.sale_start_at ? new Date(body.sale_start_at) : null,
          saleEndAt: body.sale_end_at ? new Date(body.sale_end_at) : null,
          status,
          displayOrder: body.display_order ?? 0,
        },
      });

      res.status(201).json(
        successResponse(formatAdminTicketOffering(offering, currencyMeta.currency)),
      );
    } catch (err) {
      next(err);
    }
  },

  updateEventTicketOffering: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const offeringRef = String(req.params.offeringId);
      const body = adminTicketOfferingUpdateSchema.parse(req.body);

      const typeRef = resolveOfferingRef(offeringRef);
      const existing = await prisma.eventTicketOffering.findFirst({
        where: {
          eventId,
          OR: [{ id: offeringRef }, ...(typeRef ? [{ type: typeRef }] : [])],
        },
      });
      if (!existing) {
        throw new AppError(404, 'TICKET_OFFERING_NOT_FOUND', 'Ticket offering not found');
      }

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      const currencyMeta = getEventCurrencyMeta(event?.countryCode ?? 'CL');

      const nextStockRemaining =
        body.stock_remaining !== undefined ? body.stock_remaining : existing.stockRemaining;
      const nextStatus =
        body.status ??
        (nextStockRemaining != null
          ? normalizeStatusAfterStockChange(existing.status, nextStockRemaining)
          : existing.status);

      const offering = await prisma.eventTicketOffering.update({
        where: { id: existing.id },
        data: {
          ...(body.type != null ? { type: body.type } : {}),
          ...(body.name != null ? { name: body.name.trim() } : {}),
          ...(body.price != null ? { price: body.price } : {}),
          ...(body.stock_total !== undefined ? { stockTotal: body.stock_total } : {}),
          ...(body.stock_remaining !== undefined
            ? { stockRemaining: body.stock_remaining }
            : {}),
          ...(body.sale_start_at !== undefined
            ? { saleStartAt: body.sale_start_at ? new Date(body.sale_start_at) : null }
            : {}),
          ...(body.sale_end_at !== undefined
            ? { saleEndAt: body.sale_end_at ? new Date(body.sale_end_at) : null }
            : {}),
          ...(body.display_order != null ? { displayOrder: body.display_order } : {}),
          status: nextStatus,
        },
      });

      res.json(successResponse(formatAdminTicketOffering(offering, currencyMeta.currency)));
    } catch (err) {
      next(err);
    }
  },

  deleteEventTicketOffering: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const offeringRef = String(req.params.offeringId);

      const typeRef = resolveOfferingRef(offeringRef);
      const existing = await prisma.eventTicketOffering.findFirst({
        where: {
          eventId,
          OR: [{ id: offeringRef }, ...(typeRef ? [{ type: typeRef }] : [])],
        },
      });
      if (!existing) {
        throw new AppError(404, 'TICKET_OFFERING_NOT_FOUND', 'Ticket offering not found');
      }

      await prisma.eventTicketOffering.delete({ where: { id: existing.id } });
      res.json(successResponse({ deleted: true, offering_id: existing.id }));
    } catch (err) {
      next(err);
    }
  },
};
