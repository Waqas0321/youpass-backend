import type { Request, Response } from 'express';
import { eventsService } from '../events/events.service.js';
import { successResponse } from '../../common/utils/crypto.js';

export const homeRouter = {
  getInitialFeed: async (req: Request, res: Response) => {
    const countryCode = typeof req.query.country_code === 'string' ? req.query.country_code : undefined;
    const userId = req.user?.id;

    const [eventTypes, featured] = await Promise.all([
      eventsService.listEventTypes(),
      eventsService.getFeaturedEvents({ country_code: countryCode, limit: 10 }, userId),
    ]);

    res.json(
      successResponse({
        event_types: eventTypes,
        carousel: featured.carousel,
        featured_events: featured.events,
        greeting: req.user ? { full_name: req.user.fullName } : null,
      }),
    );
  },
};
