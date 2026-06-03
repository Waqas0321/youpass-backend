import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import { env } from '../../config/env.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.PROFILE_PHOTO_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Profile photo must be JPEG, PNG, WebP, or HEIC'));
      return;
    }
    cb(null, true);
  },
}).single('photo');

export function uploadProfilePhoto(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof AppError) {
      next(err);
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            400,
            'FILE_TOO_LARGE',
            `Profile photo must be ${Math.floor(env.PROFILE_PHOTO_MAX_BYTES / (1024 * 1024))} MB or smaller`,
          ),
        );
        return;
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        next(new AppError(400, 'INVALID_FIELD', 'Use multipart field name "photo" for the image file'));
        return;
      }

      next(new AppError(400, 'UPLOAD_ERROR', err.message));
      return;
    }

    next(err);
  });
}
