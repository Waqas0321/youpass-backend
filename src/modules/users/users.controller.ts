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

  getProfileBannerStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getProfileBannerStatus(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  dismissProfileBanner: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.dismissProfileBanner(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteProfilePhoto: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.deleteProfilePhoto(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getCategoryBenefits: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getCategoryBenefits(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getNotificationSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getNotificationSettings(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  updateNotificationSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.updateNotificationSettings(req.user!.id, req.body);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  toggleNotificationsMaster: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.toggleNotificationsMaster(req.user!.id, req.body.enabled);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getDeletionStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.getDeletionStatus(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  cancelAccountDeletion: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await usersService.cancelAccountDeletion(req.user!.id);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
