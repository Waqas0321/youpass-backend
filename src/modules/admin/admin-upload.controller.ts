import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { AppError } from '../../common/errors/app-error.js';
import { cloudinaryService } from '../../common/services/cloudinary.service.js';
import { isAllowedAdminUploadFolder } from '../../config/cloudinary-folders.js';
import { env } from '../../config/env.js';

function resolveFolder(raw: unknown): string {
  if (typeof raw === 'string' && isAllowedAdminUploadFolder(raw)) {
    return raw.trim();
  }
  return env.CLOUDINARY_DRINK_PRODUCTS_FOLDER;
}

export const adminUploadController = {
  uploadImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file?.buffer) {
        throw new AppError(400, 'MISSING_FILE', 'Image file is required');
      }

      const folder = resolveFolder(req.body?.folder);
      const imageUrl = await cloudinaryService.uploadAdminImage(req.file.buffer, { folder });

      res.status(201).json(
        successResponse({
          url: imageUrl,
          folder,
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  uploadVideo: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file?.buffer) {
        throw new AppError(400, 'MISSING_FILE', 'Video file is required');
      }

      const folder = resolveFolder(req.body?.folder);
      const videoUrl = await cloudinaryService.uploadAdminVideo(req.file.buffer, { folder });

      res.status(201).json(
        successResponse({
          url: videoUrl,
          folder,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
};
