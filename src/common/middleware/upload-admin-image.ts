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
    fileSize: env.ADMIN_IMAGE_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Image must be JPEG, PNG, WebP, or HEIC'));
      return;
    }
    cb(null, true);
  },
}).single('image');

export function uploadAdminImage(req: Request, res: Response, next: NextFunction): void {
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
            `Image must be ${Math.floor(env.ADMIN_IMAGE_MAX_BYTES / (1024 * 1024))} MB or smaller`,
          ),
        );
        return;
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        next(new AppError(400, 'INVALID_FIELD', 'Use multipart field name "image" for the file'));
        return;
      }

      next(new AppError(400, 'UPLOAD_ERROR', err.message));
      return;
    }

    next(err);
  });
}
