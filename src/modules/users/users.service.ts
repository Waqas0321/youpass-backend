import { prisma } from '../../config/database.js';
import { calculateAge, computeProfileCompletion } from '../../common/utils/crypto.js';
import { formatPhoneDisplay } from '../../common/utils/phone.js';
import { cloudinaryService } from '../../common/services/cloudinary.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { env } from '../../config/env.js';
import { authService } from '../auth/auth.service.js';
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

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const data: {
      fullName?: string;
      email?: string;
      rutOrPassport?: string;
      birthdate?: Date;
      gender?: User['gender'];
      instagramUsername?: string | null;
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
};
