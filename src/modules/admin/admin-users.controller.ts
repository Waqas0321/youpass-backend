import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { adminUsersService } from './admin-users.service.js';
import {
  adminUserBlockSchema,
  adminUserUpdateSchema,
  adminUsersListQuerySchema,
} from './admin-users.validators.js';

export const adminUsersController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = adminUsersListQuerySchema.parse(req.query);
      res.json(successResponse(await adminUsersService.list(query)));
    } catch (err) {
      next(err);
    }
  },

  detail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse(await adminUsersService.detail(String(req.params.userId))));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminUserUpdateSchema.parse(req.body);
      res.json(successResponse(await adminUsersService.update(String(req.params.userId), body)));
    } catch (err) {
      next(err);
    }
  },

  block: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = adminUserBlockSchema.parse(req.body ?? {});
      res.json(
        successResponse(await adminUsersService.block(String(req.params.userId), body.reason)),
      );
    } catch (err) {
      next(err);
    }
  },

  unblock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse(await adminUsersService.unblock(String(req.params.userId))));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse(await adminUsersService.remove(String(req.params.userId))));
    } catch (err) {
      next(err);
    }
  },
};
