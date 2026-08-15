import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import { env } from '../../config/env.js';

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.ADMIN_VIDEO_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Video must be MP4, MOV, WebM, or AVI'));
      return;
    }
    cb(null, true);
  },
}).single('video');

export function uploadAdminVideo(req: Request, res: Response, next: NextFunction): void {
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
            `Video must be ${Math.floor(env.ADMIN_VIDEO_MAX_BYTES / (1024 * 1024))} MB or smaller`,
          ),
        );
        return;
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        next(new AppError(400, 'INVALID_FIELD', 'Use multipart field name "video" for the file'));
        return;
      }

      next(new AppError(400, 'UPLOAD_ERROR', err.message));
      return;
    }

    next(err);
  });
}
