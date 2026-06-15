import { prisma } from '../../config/database.js';
import { calculateAge, computeProfileCompletion } from '../../common/utils/crypto.js';
import { formatPhoneDisplay } from '../../common/utils/phone.js';
import { cloudinaryService } from '../../common/services/cloudinary.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { env } from '../../config/env.js';
import { authService } from '../auth/auth.service.js';
import { CATEGORY_BENEFITS } from './category-benefits.data.js';
import { notificationSettingsService } from './notification-settings.service.js';
import type { DeleteAccountVerifyInput } from '../auth/auth.validators.js';
import type { UpdateProfileInput } from './users.validators.js';
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
  const base = {
    id: user.id,
    phone: user.phone,
    phone_display: formatPhoneDisplay(user.phone, user.countryCode),
    country_code: user.countryCode,
    preferred_language: user.preferredLanguage ?? null,
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

  if (user.accountStatus !== 'pending_deletion' || !user.deletionScheduledAt) {
    return {
      ...base,
      pending_deletion: false,
      deletion_scheduled_at: null,
      days_remaining: null,
    };
  }

  const now = new Date();
  const msRemaining = user.deletionScheduledAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return {
    ...base,
    pending_deletion: true,
    deletion_requested_at: user.deletionRequestedAt?.toISOString() ?? null,
    deletion_scheduled_at: user.deletionScheduledAt.toISOString(),
    days_remaining: daysRemaining,
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

  async getProfileBannerStatus(userId: string) {
    const completeness = await this.getProfileCompleteness(userId);
    const isComplete = completeness.has_photo && completeness.has_instagram;

    if (isComplete) {
      return {
        show_banner: false,
        completion_percentage: completeness.completion_percentage,
        missing_fields: completeness.missing_fields,
        reason: 'profile_complete',
      };
    }

    const showAgainAt = completeness.banner_show_again_at
      ? new Date(completeness.banner_show_again_at)
      : null;

    if (showAgainAt && showAgainAt > new Date()) {
      return {
        show_banner: false,
        completion_percentage: completeness.completion_percentage,
        missing_fields: completeness.missing_fields,
        dismissed_until: showAgainAt.toISOString(),
        reason: 'dismissed',
      };
    }

    return {
      show_banner: true,
      completion_percentage: completeness.completion_percentage,
      missing_fields: completeness.missing_fields,
      reason: 'incomplete',
    };
  },

  async dismissProfileBanner(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const hasPhoto = Boolean(user.profilePhotoUrl);
    const hasInstagram = Boolean(user.instagramUsername);
    const dismissedAt = new Date();
    const showAgainAt = new Date(dismissedAt);
    showAgainAt.setDate(showAgainAt.getDate() + 7);

    await prisma.userProfileCompletion.upsert({
      where: { userId },
      create: {
        userId,
        hasPhoto,
        hasInstagram,
        completionPercentage: computeProfileCompletion(hasPhoto, hasInstagram),
        bannerDismissedAt: dismissedAt,
        bannerShowAgainAt: showAgainAt,
      },
      update: {
        bannerDismissedAt: dismissedAt,
        bannerShowAgainAt: showAgainAt,
      },
    });

    return {
      dismissed_at: dismissedAt.toISOString(),
      show_again_at: showAgainAt.toISOString(),
    };
  },

  async getCategoryBenefits(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const tier = user.category;
    const benefits = CATEGORY_BENEFITS[tier];

    return {
      category: tier,
      title_es: benefits.title_es,
      title_en: benefits.title_en,
      benefits_es: benefits.benefits_es,
      benefits_en: benefits.benefits_en,
      next_category:
        tier === 'bronze' ? 'silver' : tier === 'silver' ? 'gold' : null,
    };
  },

  async getDeletionStatus(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.accountStatus !== 'pending_deletion' || !user.deletionScheduledAt) {
      return {
        status: user.accountStatus,
        pending_deletion: false,
        deletion_scheduled_at: null,
        days_remaining: null,
      };
    }

    const now = new Date();
    const scheduled = user.deletionScheduledAt;
    const msRemaining = scheduled.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

    return {
      status: user.accountStatus,
      pending_deletion: true,
      deletion_requested_at: user.deletionRequestedAt?.toISOString() ?? null,
      deletion_scheduled_at: scheduled.toISOString(),
      days_remaining: daysRemaining,
    };
  },

  async cancelAccountDeletion(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.accountStatus !== 'pending_deletion') {
      throw new AppError(400, 'NOT_PENDING_DELETION', 'Account is not pending deletion');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'active',
        deletionRequestedAt: null,
        deletionScheduledAt: null,
      },
    });

    return {
      message: 'Account deletion cancelled. Your YOUPASS account is still active.',
      status: 'active',
    };
  },

  getNotificationSettings(userId: string) {
    return notificationSettingsService.getSettings(userId);
  },

  updateNotificationSettings(
    userId: string,
    input: Parameters<typeof notificationSettingsService.updateSettings>[1],
  ) {
    return notificationSettingsService.updateSettings(userId, input);
  },

  toggleNotificationsMaster(userId: string, enabled: boolean) {
    return notificationSettingsService.toggleMaster(userId, enabled);
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

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const data: {
      fullName?: string;
      email?: string;
      rutOrPassport?: string;
      birthdate?: Date;
      gender?: User['gender'];
      instagramUsername?: string | null;
      preferredLanguage?: string;
    } = {};

    if (input.full_name !== undefined) {
      data.fullName = input.full_name.trim();
    }

    if (input.email !== undefined) {
      data.email = input.email.toLowerCase().trim();
    }

    if (input.rut_or_passport !== undefined) {
      data.rutOrPassport = input.rut_or_passport.trim();
    }

    if (input.birthdate !== undefined) {
      const birthdate = new Date(input.birthdate);
      if (Number.isNaN(birthdate.getTime())) {
        throw new AppError(400, 'INVALID_BIRTHDATE', 'Invalid birthdate');
      }

      if (calculateAge(birthdate) < env.MIN_AGE_YEARS) {
        throw new AppError(
          403,
          'UNDERAGE',
          'YouPass is only available to users aged 18 and over.',
        );
      }

      data.birthdate = birthdate;
    }

    if (input.gender !== undefined) {
      data.gender = input.gender;
    }

    if (input.instagram_username !== undefined) {
      data.instagramUsername = input.instagram_username;
    }

    if (input.preferred_language !== undefined) {
      data.preferredLanguage = input.preferred_language;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    const hasPhoto = Boolean(user.profilePhotoUrl);
    const hasInstagram = Boolean(user.instagramUsername);

    await prisma.userProfileCompletion.upsert({
      where: { userId },
      create: {
        userId,
        hasPhoto,
        hasInstagram,
        completionPercentage: computeProfileCompletion(hasPhoto, hasInstagram),
      },
      update: {
        hasInstagram,
        completionPercentage: computeProfileCompletion(hasPhoto, hasInstagram),
      },
    });

    return formatUserProfile(user);
  },

  async updateProfilePhoto(userId: string, file: Express.Multer.File) {
    if (!file.buffer?.length) {
      throw new AppError(400, 'FILE_REQUIRED', 'Profile photo file is required');
    }

    const profilePhotoUrl = await cloudinaryService.uploadProfilePhoto(userId, file.buffer);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl },
    });

    const hasInstagram = Boolean(user.instagramUsername);

    await prisma.userProfileCompletion.upsert({
      where: { userId },
      create: {
        userId,
        hasPhoto: true,
        hasInstagram,
        completionPercentage: computeProfileCompletion(true, hasInstagram),
      },
      update: {
        hasPhoto: true,
        completionPercentage: computeProfileCompletion(true, hasInstagram),
      },
    });

    return formatUserProfile(user);
  },

  async deleteProfilePhoto(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: null },
    });

    const hasInstagram = Boolean(user.instagramUsername);

    await prisma.userProfileCompletion.upsert({
      where: { userId },
      create: {
        userId,
        hasPhoto: false,
        hasInstagram,
        completionPercentage: computeProfileCompletion(false, hasInstagram),
      },
      update: {
        hasPhoto: false,
        completionPercentage: computeProfileCompletion(false, hasInstagram),
      },
    });

    return formatUserProfile(user);
  },
};
