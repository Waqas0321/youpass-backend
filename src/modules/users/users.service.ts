import { prisma } from '../../config/database.js';
import { toPublicUser, computeProfileCompletion } from '../../common/utils/crypto.js';
import { authService } from '../auth/auth.service.js';
import type { User } from '@prisma/client';

function profileCompleteness(user: User) {
  const hasPhoto = Boolean(user.profilePhotoUrl);
  const hasInstagram = Boolean(user.instagramUsername);
  return {
    has_photo: hasPhoto,
    has_instagram: hasInstagram,
    completion_percentage: computeProfileCompletion(hasPhoto, hasInstagram),
    missing_fields: [
      ...(!hasPhoto ? ['profile_photo'] : []),
      ...(!hasInstagram ? ['instagram_username'] : []),
    ],
  };
}

export const usersService = {
  async getProfile(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      ...toPublicUser(user),
      rut_or_passport: user.rutOrPassport,
      profile_completeness: profileCompleteness(user),
    };
  },

  async getWelcomeData(user: User) {
    return authService.getWelcomeData(user);
  },

  async getProfileCompleteness(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const completion = await prisma.userProfileCompletion.findUnique({
      where: { userId },
    });
    return {
      ...profileCompleteness(user),
      banner_dismissed_at: completion?.bannerDismissedAt?.toISOString() ?? null,
      banner_show_again_at: completion?.bannerShowAgainAt?.toISOString() ?? null,
    };
  },

  async logout(user: User, sessionId: string) {
    return authService.logout(user, sessionId);
  },
};
