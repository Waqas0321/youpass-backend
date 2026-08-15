import { env } from './env.js';

/** Cloudinary folders allowed for admin multipart uploads (`POST /admin/uploads/*`). */
export function getAdminUploadFolders(): readonly string[] {
  return [
    env.CLOUDINARY_PROFILE_FOLDER,
    env.CLOUDINARY_DRINK_PRODUCTS_FOLDER,
    env.CLOUDINARY_EVENT_IMAGES_FOLDER,
    env.CLOUDINARY_TICKET_IMAGES_FOLDER,
    env.CLOUDINARY_VENUE_LAYOUTS_FOLDER,
    env.CLOUDINARY_ADMIN_FOLDER,
  ];
}

export function isAllowedAdminUploadFolder(folder: string): boolean {
  return getAdminUploadFolders().includes(folder.trim());
}
