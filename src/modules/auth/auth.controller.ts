import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { successResponse } from '../../common/utils/crypto.js';

function getContext(req: Request) {
  return req.authContext;
}

export const authController = {
  sendCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.sendCode(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  resendCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.resendCode(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  verifyCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.verifyCode(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  checkWhatsApp: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.checkWhatsApp(req.body);
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.login(req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.register(req.body, getContext(req));
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.logout(req.user!, req.sessionId!);
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  changePhoneRequest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.changePhoneRequest(req.user!, req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  changePhoneVerify: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.changePhoneVerify(req.user!, req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteAccountRequest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.deleteAccountRequest(req.user!, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteAccountVerify: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await authService.deleteAccountVerify(req.user!, req.body, getContext(req));
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
