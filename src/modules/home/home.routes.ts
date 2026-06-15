import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { homeFeedQuerySchema, upcomingEventsQuerySchema } from '../events/events.validators.js';
import { eventsService } from '../events/events.service.js';
import { homeService } from './home.service.js';

function parseExcludeIds(value?: string): string[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length ? ids : undefined;
}

export const homeRouter = {
  getInitialFeed: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = homeFeedQuerySchema.parse(req.query);
      const data = await homeService.getInitialFeed(query, req.user);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getUpcomingEvents: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = upcomingEventsQuerySchema.parse(req.query);
      const data = await eventsService.listUpcomingEvents(
        {
          country_code: query.country_code,
          event_type: query.event_type,
          page: query.page,
          limit: query.limit,
          near_me: query.near_me,
          lat: query.lat,
          lng: query.lng,
          exclude_ids: parseExcludeIds(query.exclude_ids),
        },
        req.user?.id,
      );
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
