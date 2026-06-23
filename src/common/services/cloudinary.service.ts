import type { UploadApiResponse } from 'cloudinary';
import { AppError } from '../errors/app-error.js';
import { cloudinary, configureCloudinary, isCloudinaryConfigured } from '../../config/cloudinary.js';
import { env } from '../../config/env.js';

function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new AppError(
      503,
      'CLOUDINARY_NOT_CONFIGURED',
      'Profile photo upload is not available. Cloudinary credentials are missing.',
    );
  }
  configureCloudinary();
}

export const cloudinaryService = {
  uploadAdminImage(
    buffer: Buffer,
    options: { folder: string; publicId?: string },
  ): Promise<string> {
    assertCloudinaryReady();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          overwrite: Boolean(options.publicId),
          invalidate: true,
          resource_type: 'image',
          transformation: [
            {
              width: 900,
              height: 900,
              crop: 'fill',
              gravity: 'auto',
              quality: 'auto',
              fetch_format: 'auto',
            },
          ],
        },
        (error: Error | undefined, result: UploadApiResponse | undefined) => {
          if (error || !result?.secure_url) {
            console.error('Cloudinary upload failed:', error);
            reject(new AppError(502, 'UPLOAD_FAILED', 'Failed to upload image. Please try again.'));
            return;
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  },

  uploadProfilePhoto(userId: string, buffer: Buffer): Promise<string> {
    assertCloudinaryReady();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: env.CLOUDINARY_PROFILE_FOLDER,
          public_id: userId,
          overwrite: true,
          invalidate: true,
          resource_type: 'image',
          transformation: [
            {
              width: 800,
              height: 800,
              crop: 'fill',
              gravity: 'face',
              quality: 'auto',
              fetch_format: 'auto',
            },
          ],
        },
        (error: Error | undefined, result: UploadApiResponse | undefined) => {
          if (error || !result?.secure_url) {
            console.error('Cloudinary upload failed:', error);
            reject(new AppError(502, 'UPLOAD_FAILED', 'Failed to upload profile photo. Please try again.'));
            return;
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  },
};
