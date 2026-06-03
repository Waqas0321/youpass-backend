import type { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service.js';
import { successResponse } from '../../common/utils/crypto.js';
import { AppError } from '../../common/errors/app-error.js';

export const usersController = {
  getProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getProfile(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getWelcomeData: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getWelcomeData(req.user!);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getProfileCompleteness: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getProfileCompleteness(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.logout(req.user!, req.sessionId!);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteAccountRequest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.deleteAccountRequest(req.user!, req.authContext);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteAccountVerify: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.deleteAccountVerify(req.user!, req.body, req.authContext);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  uploadProfilePhoto: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(400, 'FILE_REQUIRED', 'Profile photo file is required. Send multipart field "photo".');
      }

      const data = await usersService.updateProfilePhoto(req.user!.id, req.file);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  updateProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.updateProfile(req.user!.id, req.body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
