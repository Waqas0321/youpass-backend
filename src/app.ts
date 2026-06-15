import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { attachRequestContext } from './common/middleware/request-context.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { configRouter } from './modules/config/config.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { producersRouter } from './modules/producers/producers.routes.js';
import { invitationsRouter } from './modules/invitations/invitations.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { homeRouter } from './modules/home/home.routes.js';
import { webhooksRouter } from './modules/webhooks/webhooks.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { doorRouter } from './modules/door/door.routes.js';
import { producerInvitationsRouter, producerEventsRouter } from './modules/producer-invitations/producer-invitations.routes.js';
import { systemInvitationsRouter } from './modules/system-invitations/system-invitations.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { venuesRouter } from './modules/venues/venues.routes.js';
import { waitlistOffersRouter } from './modules/waitlist/waitlist.routes.js';
import { renderKlapMockTokenizePage } from './modules/wallet/wallet-mock.controller.js';
import { optionalAuthenticate } from './common/middleware/authenticate.js';
import { prisma } from './config/database.js';
import { logTwilioWhatsAppStartupSummary } from './config/twilio-whatsapp.config.js';

export function createApp() {
  logTwilioWhatsAppStartupSummary();
  const app = express();

  app.use(
    helmet({
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(cors());
  // strict: false — Flutter sends Content-Type: application/json with an empty/null body on POST
  app.use(express.json({ limit: '1mb', strict: false }));
  app.use(attachRequestContext);

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'youpass-api' } });
  });

  api.get('/health/db', async (_req, res, next) => {
    try {
      await prisma.$runCommandRaw({ ping: 1 });
      res.json({ success: true, data: { status: 'ok', database: 'connected' } });
    } catch (err) {
      next(err);
    }
  });

  api.use('/auth', authRouter);
  api.use('/config', configRouter);
  api.use('/users', usersRouter);
  api.use('/events', eventsRouter);
  api.use('/producers', producersRouter);
  api.use('/invitations', invitationsRouter);
  api.use('/waitlist/offers', waitlistOffersRouter);
  api.use('/tickets', ticketsRouter);
  api.get('/home/initial-feed', optionalAuthenticate, homeRouter.getInitialFeed);
  api.get('/home/upcoming-events', optionalAuthenticate, homeRouter.getUpcomingEvents);
  api.use('/analytics', analyticsRouter);
  api.use('/support', supportRouter);
  api.use('/door', doorRouter);
  api.use('/producer/invitations', producerInvitationsRouter);
  api.use('/producer/events', producerEventsRouter);
  api.use('/system/invitations', systemInvitationsRouter);
  api.use('/admin', adminRouter);
  api.use('/venues', venuesRouter);
  api.get('/wallet/klap/mock-tokenize', renderKlapMockTokenizePage);
  api.use('/webhooks', webhooksRouter);

  app.use(env.API_PREFIX, api);
  app.use(errorHandler);

  return app;
}
