import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { attachRequestContext } from './common/middleware/request-context.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { configRouter } from './modules/config/config.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { homeRouter } from './modules/home/home.routes.js';
import { authenticate } from './common/middleware/authenticate.js';
import { prisma } from './config/database.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
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
  api.get('/home/initial-feed', authenticate, homeRouter.getInitialFeed);

  app.use(env.API_PREFIX, api);
  app.use(errorHandler);

  return app;
}
