import type { NextFunction, Request, Response } from 'express';
import { staffAuthService } from './staff-auth.service.js';
import { successResponse } from '../../common/utils/crypto.js';
import type { AuthRequestContext } from '../../common/types/auth.js';

function getContext(req: Request): AuthRequestContext {
  return req.authContext ?? {};
}

export const staffAuthController = {
  sendCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffAuthService.sendCode(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  resendCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffAuthService.resendCode(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffAuthService.login(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffAuthService.logout(req.staffMember!.id, req.sessionId!);
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await staffAuthService.getProfile(req.staffMember!.id);
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
