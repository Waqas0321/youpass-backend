import type { User, StaffMember } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      staffMember?: StaffMember;
      sessionId?: string;
      accessToken?: string;
      authContext?: import('./auth.js').AuthRequestContext;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
