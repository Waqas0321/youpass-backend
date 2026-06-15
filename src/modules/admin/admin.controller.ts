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
import { formatEvent, formatEventType } from '../events/events.formatter.js';
import { getCountrySync } from '../../common/services/country-config.service.js';
import { getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  formatTicketOffering,
} from '../vip-venue/vip-venue.formatter.js';
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
        include: { eventType: true },
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
              id: event.id,
              title: event.title,
              description: event.description,
              starts_at: event.startsAt.toISOString(),
              venue_name: event.venueName,
              city: event.city,
              country_code: event.countryCode,
              image_url: event.imageUrl,
              producer_name: event.producerName,
              latitude: event.latitude,
              longitude: event.longitude,
              status: event.status,
              is_featured: event.isFeatured,
              featured_order: event.featuredOrder,
              event_type: formatEventType(event.eventType),
              starts_at_display: formatted.starts_at_display,
              location_display: formatted.location_display,
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
            formatTicketOffering(offering, currencyMeta.currency, now),
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
      const mapsToTier = body.maps_to_tier ?? (body.section === 'vip' ? 'vip' : 'general');
      const mapsToType = body.maps_to_type ?? (body.section === 'vip' ? 'vip' : 'general');

      const offering = await prisma.eventTicketOffering.create({
        data: {
          eventId,
          slug: body.slug,
          label: body.label,
          description: body.description ?? null,
          section: body.section,
          price: body.price,
          currency: currencyMeta.currency,
          badgeLabel: body.badge_label ?? null,
          displayOrder: body.display_order ?? 0,
          stockQuantity: body.stock_quantity ?? null,
          saleStartsAt: body.sale_starts_at ? new Date(body.sale_starts_at) : null,
          saleEndsAt: body.sale_ends_at ? new Date(body.sale_ends_at) : null,
          isActive: body.is_active ?? true,
          mapsToTier,
          mapsToType,
        },
      });

      res.status(201).json(
        successResponse(formatTicketOffering(offering, currencyMeta.currency)),
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

      const existing = await prisma.eventTicketOffering.findFirst({
        where: {
          eventId,
          OR: [{ id: offeringRef }, { slug: offeringRef }],
        },
      });
      if (!existing) {
        throw new AppError(404, 'TICKET_OFFERING_NOT_FOUND', 'Ticket offering not found');
      }

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      const currencyMeta = getEventCurrencyMeta(event?.countryCode ?? 'CL');

      const offering = await prisma.eventTicketOffering.update({
        where: { id: existing.id },
        data: {
          ...(body.slug != null ? { slug: body.slug } : {}),
          ...(body.label != null ? { label: body.label } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.section != null ? { section: body.section } : {}),
          ...(body.price != null ? { price: body.price } : {}),
          ...(body.badge_label !== undefined ? { badgeLabel: body.badge_label } : {}),
          ...(body.display_order != null ? { displayOrder: body.display_order } : {}),
          ...(body.stock_quantity !== undefined ? { stockQuantity: body.stock_quantity } : {}),
          ...(body.sale_starts_at !== undefined
            ? { saleStartsAt: body.sale_starts_at ? new Date(body.sale_starts_at) : null }
            : {}),
          ...(body.sale_ends_at !== undefined
            ? { saleEndsAt: body.sale_ends_at ? new Date(body.sale_ends_at) : null }
            : {}),
          ...(body.is_active != null ? { isActive: body.is_active } : {}),
          ...(body.maps_to_tier != null ? { mapsToTier: body.maps_to_tier } : {}),
          ...(body.maps_to_type != null ? { mapsToType: body.maps_to_type } : {}),
        },
      });

      res.json(successResponse(formatTicketOffering(offering, currencyMeta.currency)));
    } catch (err) {
      next(err);
    }
  },

  deleteEventTicketOffering: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = String(req.params.eventId);
      const offeringRef = String(req.params.offeringId);

      const existing = await prisma.eventTicketOffering.findFirst({
        where: {
          eventId,
          OR: [{ id: offeringRef }, { slug: offeringRef }],
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
