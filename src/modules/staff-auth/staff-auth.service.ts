import type { AuthCodePurpose } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { isWhatsAppDeliveryMock } from '../../config/meta-whatsapp.config.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  AUTH_ERROR_CODES,
  OTP_PURPOSE_LABELS,
  STAFF_AUTH_ERROR_CODES,
} from '../../config/constants.js';
import {
  addMinutes,
  addSeconds,
  generateOtp,
  hashOtp,
  minutesUntil,
  secondsUntil,
  verifyOtp,
} from '../../common/utils/crypto.js';
import { formatPhoneDisplay, parseAndValidatePhone } from '../../common/utils/phone.js';
import { getActiveCountry } from '../../common/services/country-config.service.js';
import type { AuthRequestContext } from '../../common/types/auth.js';
import {
  blockedMessage,
  bruteForceBlockedMessage,
  codeExpiredMessage,
  maxResendsMessage,
} from '../../common/constants/auth-messages.js';
import {
  otpDeliveryService,
  whatsAppReadyMessage,
  whatsAppUnavailableMessage,
} from '../auth/otp-delivery.service.js';
import { formatStaffAuthProfile } from './staff-auth.formatter.js';
import { createStaffSession, revokeStaffSession } from './staff-auth.session.service.js';
import type { StaffLoginInput, StaffSendCodeInput } from './staff-auth.validators.js';

const STAFF_LOGIN_PURPOSE: AuthCodePurpose = 'staff_login';

type OtpContext = AuthRequestContext | undefined;

function whereAuthCodeUnused() {
  return { OR: [{ usedAt: null }, { usedAt: { isSet: false } }] };
}

async function getOrCreateRateLimit(phone: string) {
  return prisma.authRateLimit.upsert({
    where: { phone },
    create: { phone },
    update: {},
  });
}

async function assertNotBlocked(phone: string): Promise<void> {
  const limit = await getOrCreateRateLimit(phone);
  if (limit.blockedUntil && limit.blockedUntil > new Date()) {
    const minutes = minutesUntil(limit.blockedUntil);
    throw new AppError(
      429,
      AUTH_ERROR_CODES.BLOCKED,
      blockedMessage(minutes),
      { retry_after_seconds: secondsUntil(limit.blockedUntil) },
    );
  }
}

async function resetFailedAttempts(phone: string): Promise<void> {
  await prisma.authRateLimit.update({
    where: { phone },
    data: { failedAttempts: 0, blockedUntil: null },
  });
}

async function incrementFailedAttempt(phone: string): Promise<void> {
  const limit = await getOrCreateRateLimit(phone);
  const failedAttempts = limit.failedAttempts + 1;
  const blockedUntil =
    failedAttempts >= env.OTP_MAX_FAILED_ATTEMPTS
      ? addMinutes(new Date(), env.OTP_BLOCK_MINUTES)
      : null;

  await prisma.authRateLimit.update({
    where: { phone },
    data: { failedAttempts, blockedUntil },
  });

  if (blockedUntil) {
    throw new AppError(
      429,
      AUTH_ERROR_CODES.BLOCKED,
      bruteForceBlockedMessage(),
      { retry_after_seconds: env.OTP_BLOCK_MINUTES * 60 },
    );
  }
}

async function assertResendAllowed(phone: string, isResend: boolean): Promise<void> {
  const limit = await getOrCreateRateLimit(phone);
  const now = new Date();

  if (isResend && limit.lastResendAt) {
    const cooldownEnds = addSeconds(limit.lastResendAt, env.OTP_RESEND_COOLDOWN_SECONDS);
    if (cooldownEnds > now) {
      throw new AppError(
        429,
        AUTH_ERROR_CODES.RESEND_COOLDOWN,
        `Resend code in ${secondsUntil(cooldownEnds)} second(s)`,
        { retry_after_seconds: secondsUntil(cooldownEnds) },
      );
    }
  }

  let resendCount = limit.resendCountHour;
  let resetAt = limit.resendCountResetAt;

  if (!resetAt || resetAt <= now) {
    resendCount = 0;
    resetAt = addMinutes(now, 60);
  }

  if (isResend && resendCount >= env.OTP_MAX_RESENDS_PER_HOUR) {
    throw new AppError(
      429,
      AUTH_ERROR_CODES.MAX_RESENDS,
      maxResendsMessage(minutesUntil(resetAt)),
      { retry_after_seconds: secondsUntil(resetAt) },
    );
  }
}

async function invalidatePreviousCodes(phone: string): Promise<void> {
  await prisma.authCode.updateMany({
    where: {
      phone,
      purpose: STAFF_LOGIN_PURPOSE,
      expiresAt: { gt: new Date() },
      ...whereAuthCodeUnused(),
    },
    data: { usedAt: new Date() },
  });
}

async function assertStaffMemberExists(e164: string) {
  const staffMember = await prisma.staffMember.findUnique({
    where: { phone: e164 },
    include: { role: true, zone: true },
  });

  if (!staffMember) {
    throw new AppError(
      404,
      STAFF_AUTH_ERROR_CODES.STAFF_NOT_FOUND,
      'No staff account found for this phone number',
    );
  }

  return staffMember;
}

async function createAndSendStaffOtp(
  e164: string,
  countryCode: string,
  isResend: boolean,
): Promise<{
  expires_in_seconds: number;
  resend_available_in_seconds: number;
  phone_display: string;
  dev_otp_code?: string;
}> {
  await assertNotBlocked(e164);
  await assertResendAllowed(e164, isResend);
  await assertStaffMemberExists(e164);

  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const code = generateOtp(env.OTP_LENGTH);
  const codeHash = await hashOtp(code);
  const expiresAt = addMinutes(new Date(), env.OTP_TTL_MINUTES);

  await invalidatePreviousCodes(e164);

  await prisma.authCode.create({
    data: {
      phone: e164,
      codeHash,
      purpose: STAFF_LOGIN_PURPOSE,
      countryCode,
      expiresAt,
      sentVia: 'whatsapp',
      whatsappTemplate: OTP_PURPOSE_LABELS.staff_login,
    },
  });

  const limit = await getOrCreateRateLimit(e164);
  const now = new Date();
  let resendCount = limit.resendCountHour;
  let resetAt = limit.resendCountResetAt;
  if (!resetAt || resetAt <= now) {
    resendCount = 0;
    resetAt = addMinutes(now, 60);
  }

  await prisma.authRateLimit.update({
    where: { phone: e164 },
    data: {
      lastResendAt: now,
      resendCountHour: isResend ? resendCount + 1 : resendCount,
      resendCountResetAt: resetAt,
    },
  });

  try {
    await otpDeliveryService.sendOtp({
      phone: e164,
      purpose: 'login',
      code,
      languageCode: country?.languageCode,
    });
  } catch (err) {
    console.error('[Staff OTP delivery failed]', err);
    throw new AppError(
      502,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      'Failed to send the code via WhatsApp. Try again later.',
    );
  }

  const result = {
    expires_in_seconds: env.OTP_TTL_MINUTES * 60,
    resend_available_in_seconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    phone_display: formatPhoneDisplay(e164, countryCode),
  };

  if (isWhatsAppDeliveryMock() || env.NODE_ENV === 'development') {
    return { ...result, dev_otp_code: code };
  }

  return result;
}

async function verifyStaffOtpCode(e164: string, code: string, context?: OtpContext) {
  await assertNotBlocked(e164);

  const authCode = await prisma.authCode.findFirst({
    where: {
      phone: e164,
      purpose: STAFF_LOGIN_PURPOSE,
      ...whereAuthCodeUnused(),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!authCode) {
    const limit = await getOrCreateRateLimit(e164);
    const attemptsAfter = limit.failedAttempts + 1;
    const remainingAttempts = Math.max(0, env.OTP_MAX_FAILED_ATTEMPTS - attemptsAfter);
    await incrementFailedAttempt(e164);
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Invalid code', {
      remaining_attempts: remainingAttempts,
    });
  }

  if (authCode.expiresAt <= new Date()) {
    throw new AppError(400, AUTH_ERROR_CODES.CODE_EXPIRED, codeExpiredMessage());
  }

  const isValid = await verifyOtp(code, authCode.codeHash);

  await prisma.authAttempt.create({
    data: {
      phone: e164,
      codeId: authCode.id,
      wasSuccessful: isValid,
      deviceInfo: context?.deviceInfo as object | undefined,
      ipAddress: context?.ipAddress,
    },
  });

  if (!isValid) {
    const limit = await getOrCreateRateLimit(e164);
    const attemptsAfter = limit.failedAttempts + 1;
    const remainingAttempts = Math.max(0, env.OTP_MAX_FAILED_ATTEMPTS - attemptsAfter);
    await incrementFailedAttempt(e164);
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Incorrect code', {
      remaining_attempts: remainingAttempts,
    });
  }

  await prisma.authCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  });

  await resetFailedAttempts(e164);
}

export const staffAuthService = {
  async sendCode(input: StaffSendCodeInput, _context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const country = await getActiveCountry(countryCode);
    const whatsappAvailable = await otpDeliveryService.checkWhatsAppAvailable(e164);
    if (!whatsappAvailable) {
      throw new AppError(
        422,
        AUTH_ERROR_CODES.WHATSAPP_NOT_AVAILABLE,
        whatsAppUnavailableMessage(country.languageCode),
        { auth_channel: 'whatsapp_only' },
      );
    }

    const result = await createAndSendStaffOtp(e164, countryCode, false);

    return {
      message: `Code sent via WhatsApp. ${whatsAppReadyMessage(country.languageCode)}`,
      phone: e164,
      purpose: STAFF_LOGIN_PURPOSE,
      channel: 'whatsapp',
      whatsapp_available: true,
      ...result,
    };
  },

  async resendCode(input: StaffSendCodeInput, _context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const country = await getActiveCountry(countryCode);
    const whatsappAvailable = await otpDeliveryService.checkWhatsAppAvailable(e164);
    if (!whatsappAvailable) {
      throw new AppError(
        422,
        AUTH_ERROR_CODES.WHATSAPP_NOT_AVAILABLE,
        whatsAppUnavailableMessage(country.languageCode),
        { auth_channel: 'whatsapp_only' },
      );
    }

    const result = await createAndSendStaffOtp(e164, countryCode, true);

    return {
      message: 'Code resent via WhatsApp',
      phone: e164,
      purpose: STAFF_LOGIN_PURPOSE,
      channel: 'whatsapp',
      whatsapp_available: true,
      ...result,
    };
  },

  async login(input: StaffLoginInput, context?: OtpContext) {
    const { e164 } = await parseAndValidatePhone(input.phone, input.country_code);
    await verifyStaffOtpCode(e164, input.code, context);

    const staffMember = await assertStaffMemberExists(e164);
    const session = await createStaffSession(staffMember, context);

    await prisma.staffMember.update({
      where: { id: staffMember.id },
      data: { lastActivityAt: new Date() },
    });

    return {
      staff: formatStaffAuthProfile(staffMember),
      access_token: session.accessToken,
      session_id: session.sessionId,
      expires_at: session.expiresAt,
      session_indefinite: env.JWT_SESSION_INDEFINITE,
    };
  },

  async logout(staffMemberId: string, sessionId: string) {
    await revokeStaffSession(sessionId, staffMemberId);
    return { message: 'Logged out successfully' };
  },

  async getProfile(staffMemberId: string) {
    const staffMember = await prisma.staffMember.findUnique({
      where: { id: staffMemberId },
      include: { role: true, zone: true },
    });

    if (!staffMember) {
      throw new AppError(
        404,
        STAFF_AUTH_ERROR_CODES.STAFF_NOT_FOUND,
        'Staff account not found',
      );
    }

    return formatStaffAuthProfile(staffMember);
  },
};
