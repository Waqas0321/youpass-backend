import { prisma } from '../../config/database.js';
import { computeProfileCompletion } from '../../common/utils/crypto.js';
import { formatPhoneDisplay } from '../../common/utils/phone.js';
import { authService } from '../auth/auth.service.js';
import type { DeleteAccountVerifyInput } from '../auth/auth.validators.js';
import type { AuthRequestContext } from '../../common/types/auth.js';
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

function formatUserProfile(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    phone_display: formatPhoneDisplay(user.phone, user.countryCode),
    country_code: user.countryCode,
    full_name: user.fullName,
    email: user.email,
    birthdate: user.birthdate.toISOString().split('T')[0]!,
    gender: user.gender,
    rut_or_passport: user.rutOrPassport,
    instagram_username: user.instagramUsername,
    profile_photo_url: user.profilePhotoUrl,
    category: user.category,
    account_status: user.accountStatus,
    created_at: user.createdAt.toISOString(),
    profile_completeness: profileCompleteness(user),
  };
}

export const usersService = {
  async getProfile(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return formatUserProfile(user);
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

  async deleteAccountRequest(user: User, context?: AuthRequestContext) {
    return authService.deleteAccountRequest(user, context);
  },

  async deleteAccountVerify(user: User, input: DeleteAccountVerifyInput, context?: AuthRequestContext) {
    return authService.deleteAccountVerify(user, input, context);
  },
};
