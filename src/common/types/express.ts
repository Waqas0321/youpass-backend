import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      accessToken?: string;
      authContext?: import('./auth.js').AuthRequestContext;
    }
  }
}

export {};
