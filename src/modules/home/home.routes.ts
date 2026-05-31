import type { Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';

/** Placeholder until events module is implemented */
export const homeRouter = {
  getInitialFeed: (_req: Request, res: Response) => {
    res.json(
      successResponse({
        featured_events: [],
        upcoming_events: [],
        categories: [
          { id: 'fiesta', name: 'Fiesta' },
          { id: 'conciertos', name: 'Conciertos' },
          { id: 'bar', name: 'Bar' },
        ],
        message: 'Feed inicial — conectar módulo de eventos',
      }),
    );
  },
};
