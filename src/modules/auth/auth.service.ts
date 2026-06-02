import type { AuthCodePurpose, User } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { AUTH_ERROR_CODES, OTP_PURPOSE_LABELS } from '../../config/constants.js';
import {
  addMinutes,
  addSeconds,
  calculateAge,
  computeProfileCompletion,
  generateOtp,
  hashOtp,
  minutesUntil,
  secondsUntil,
  toPublicUser,
  verifyOtp,
} from '../../common/utils/crypto.js';
import { formatPhoneDisplay, parseAndValidatePhone } from '../../common/utils/phone.js';
import type { AuthRequestContext } from '../../common/types/auth.js';
import { otpDeliveryService } from './otp-delivery.service.js';
import { createSession, revokeAllUserSessions, revokeSession } from './session.service.js';
import type {
  ChangePhoneRequestInput,
  ChangePhoneVerifyInput,
  DeleteAccountVerifyInput,
  LoginInput,
  RegisterInput,
  SendCodeInput,
  VerifyCodeInput,
} from './auth.validators.js';

type OtpContext = AuthRequestContext | undefined;

function otpChannelLabel(channel: 'sms' | 'whatsapp'): string {
  return channel === 'sms' ? 'SMS' : 'WhatsApp';
}

function sentViaForChannel(channel: 'sms' | 'whatsapp'): 'sms' | 'whatsapp' {
  return channel;
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
      `Too many attempts. Please wait ${minutes} minute(s).`,
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
      `Too many failed attempts. Please wait ${env.OTP_BLOCK_MINUTES} minute(s).`,
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
      `Maximum resends reached. Please wait ${minutesUntil(resetAt)} minute(s).`,
      { retry_after_seconds: secondsUntil(resetAt) },
    );
  }
}

/** Prisma MongoDB: unset optional fields are not matched by `usedAt: null` alone. */
function whereAuthCodeUnused() {
  return { OR: [{ usedAt: null }, { usedAt: { isSet: false } }] };
}

async function invalidatePreviousCodes(phone: string, purpose: AuthCodePurpose): Promise<void> {
  await prisma.authCode.updateMany({
    where: { phone, purpose, expiresAt: { gt: new Date() }, ...whereAuthCodeUnused() },
    data: { usedAt: new Date() },
  });
}

async function resolveSendCodePurpose(
  e164: string,
  requestedPurpose: AuthCodePurpose,
): Promise<{ purpose: AuthCodePurpose; accountExists?: boolean }> {
  if (requestedPurpose !== 'login') {
    return { purpose: requestedPurpose };
  }

  const existingUser = await prisma.user.findUnique({ where: { phone: e164 } });
  if (!existingUser) {
    return { purpose: 'register', accountExists: false };
  }

  if (existingUser.accountStatus !== 'active') {
    throw new AppError(403, AUTH_ERROR_CODES.UNAUTHORIZED, 'This account is not active');
  }

  return { purpose: 'login', accountExists: true };
}

function mapTwilioDeliveryError(err: unknown, channel: 'sms' | 'whatsapp'): AppError {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes('credentials missing')) {
    return new AppError(
      503,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      'Twilio is not configured on the server. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel, then redeploy.',
    );
  }

  if (raw.includes('63038')) {
    return new AppError(
      429,
      AUTH_ERROR_CODES.RATE_LIMITED,
      'Daily WhatsApp message limit reached on Twilio trial. Try again tomorrow or upgrade your Twilio account.',
    );
  }

  if (raw.includes('63015')) {
    return new AppError(
      400,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      'Join the Twilio WhatsApp sandbox from your phone, then try again.',
    );
  }

  if (raw.includes('63007')) {
    return new AppError(
      502,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      'WhatsApp sender not found in your Twilio account. In Twilio Console go to Messaging → Try it out → Send a WhatsApp message, copy the sandbox number into TWILIO_WHATSAPP_FROM (e.g. +14155238886), and use SID/token from the same account.',
    );
  }

  if (raw.includes('21608') || raw.includes('21211')) {
    return new AppError(
      400,
      AUTH_ERROR_CODES.INVALID_PHONE,
      'This phone number is not verified for Twilio trial delivery.',
    );
  }

  return new AppError(
    502,
    AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
    `Failed to send the code via ${otpChannelLabel(channel)}. Try again later.`,
  );
}

async function createAndSendOtp(
  e164: string,
  countryCode: string,
  purpose: AuthCodePurpose,
  _context?: OtpContext,
  isResend = false,
): Promise<{ expires_in_seconds: number; resend_available_in_seconds: number; phone_display: string }> {
  await assertNotBlocked(e164);
  await assertResendAllowed(e164, isResend);

  const existingUser = await prisma.user.findUnique({ where: { phone: e164 } });

  if (purpose === 'register' && existingUser) {
    throw new AppError(409, AUTH_ERROR_CODES.USER_EXISTS, 'An account with this phone number already exists');
  }

  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const code = generateOtp(env.OTP_LENGTH);
  const codeHash = await hashOtp(code);
  const expiresAt = addMinutes(new Date(), env.OTP_TTL_MINUTES);

  await invalidatePreviousCodes(e164, purpose);

  const deliveryChannel = otpDeliveryService.getChannel();

  await prisma.authCode.create({
    data: {
      phone: e164,
      codeHash,
      purpose,
      countryCode,
      expiresAt,
      sentVia: sentViaForChannel(deliveryChannel),
      whatsappTemplate: OTP_PURPOSE_LABELS[purpose],
      userId: existingUser?.id,
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
      purpose,
      code,
      languageCode: country?.languageCode,
    });
  } catch (err) {
    console.error('[OTP delivery failed]', err);
    throw mapTwilioDeliveryError(err, deliveryChannel);
  }

  if (env.TWILIO_MOCK || env.NODE_ENV === 'development') {
    console.log(`[DEV OTP] ${e164} purpose=${purpose} code=${code} channel=${deliveryChannel}`);
  }

  return {
    expires_in_seconds: env.OTP_TTL_MINUTES * 60,
    resend_available_in_seconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    phone_display: formatPhoneDisplay(e164, countryCode),
  };
}

async function verifyOtpCode(
  e164: string,
  _countryCode: string,
  code: string,
  purpose: AuthCodePurpose,
  context?: OtpContext,
): Promise<{ verified: true; authCodeId: string }> {
  await assertNotBlocked(e164);

  const authCode = await prisma.authCode.findFirst({
    where: {
      phone: e164,
      purpose,
      ...whereAuthCodeUnused(),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!authCode) {
    await incrementFailedAttempt(e164);
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Invalid code');
  }

  if (authCode.expiresAt <= new Date()) {
    throw new AppError(400, AUTH_ERROR_CODES.CODE_EXPIRED, 'Code expired. Please request a new one.');
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
    await incrementFailedAttempt(e164);
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Incorrect code');
  }

  await prisma.authCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  });

  await resetFailedAttempts(e164);

  return { verified: true, authCodeId: authCode.id };
}

export const authService = {
  async sendCode(input: SendCodeInput, context?: OtpContext) {
    if (input.purpose === 'delete_account' || input.purpose === 'change_phone') {
      throw new AppError(
        400,
        'INVALID_PURPOSE',
        'This action requires authentication. Use the dedicated account endpoint instead.',
      );
    }

    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const { purpose, accountExists } = await resolveSendCodePurpose(e164, input.purpose);
    const result = await createAndSendOtp(e164, countryCode, purpose, context, false);
    const channel = otpDeliveryService.getChannel();
    return {
      message:
        accountExists === false
          ? `Code sent via ${otpChannelLabel(channel)}. Create your account to continue.`
          : `Code sent via ${otpChannelLabel(channel)}`,
      phone: e164,
      purpose,
      ...(accountExists !== undefined ? { account_exists: accountExists } : {}),
      channel,
      ...result,
    };
  },

  async resendCode(input: SendCodeInput, context?: OtpContext) {
    if (input.purpose === 'delete_account' || input.purpose === 'change_phone') {
      throw new AppError(
        400,
        'INVALID_PURPOSE',
        'This action requires authentication. Use the dedicated account endpoint instead.',
      );
    }

    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const { purpose, accountExists } = await resolveSendCodePurpose(e164, input.purpose);
    const result = await createAndSendOtp(e164, countryCode, purpose, context, true);
    const channel = otpDeliveryService.getChannel();
    return {
      message:
        accountExists === false
          ? `Code resent via ${otpChannelLabel(channel)}. Create your account to continue.`
          : `Code resent via ${otpChannelLabel(channel)}`,
      phone: e164,
      purpose,
      ...(accountExists !== undefined ? { account_exists: accountExists } : {}),
      channel,
      ...result,
    };
  },

  async verifyCode(input: VerifyCodeInput, context?: OtpContext) {
    const { e164 } = await parseAndValidatePhone(input.phone, input.country_code);
    await verifyOtpCode(e164, input.country_code.toUpperCase(), input.code, input.purpose, context);
    return {
      verified: true,
      phone: e164,
      purpose: input.purpose,
      message: 'Code verified successfully',
    };
  },

  async checkWhatsApp(input: { phone: string; country_code: string }) {
    const { e164 } = await parseAndValidatePhone(input.phone, input.country_code);
    const channel = otpDeliveryService.getChannel();
    const available = await otpDeliveryService.checkWhatsAppAvailable(e164);
    return {
      phone: e164,
      whatsapp_available: channel === 'whatsapp' ? available : false,
      delivery_channel: channel,
      message:
        channel === 'whatsapp'
          ? available
            ? 'Number is WhatsApp compatible'
            : 'Make sure WhatsApp is installed on your phone'
          : 'Codes are sent via SMS',
    };
  },

  async login(input: LoginInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    await verifyOtpCode(e164, countryCode, input.code, 'login', context);

    const user = await prisma.user.findUnique({ where: { phone: e164 } });
    if (!user || user.accountStatus !== 'active') {
      throw new AppError(404, AUTH_ERROR_CODES.USER_NOT_FOUND, 'No account found for this phone number');
    }

    const session = await createSession(user, context);

    return {
      user: toPublicUser(user),
      access_token: session.accessToken,
      session_id: session.sessionId,
      expires_at: session.expiresAt,
      is_new_user: false,
    };
  },

  async register(input: RegisterInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    await verifyOtpCode(e164, countryCode, input.code, 'register', context);

    const existing = await prisma.user.findUnique({ where: { phone: e164 } });
    if (existing) {
      throw new AppError(409, AUTH_ERROR_CODES.USER_EXISTS, 'An account with this phone number already exists');
    }

    const birthdate = new Date(input.birthdate);
    if (Number.isNaN(birthdate.getTime())) {
      throw new AppError(400, 'INVALID_BIRTHDATE', 'Invalid birthdate');
    }

    if (calculateAge(birthdate) < env.MIN_AGE_YEARS) {
      throw new AppError(
        403,
        AUTH_ERROR_CODES.UNDERAGE,
        'YouPass is only available to users aged 18 and over.',
      );
    }

    const instagram = input.instagram_username?.replace(/^@/, '') ?? null;
    const hasInstagram = Boolean(instagram);

    const user = await prisma.user.create({
      data: {
        phone: e164,
        countryCode,
        fullName: input.full_name.trim(),
        rutOrPassport: input.rut_or_passport.trim(),
        email: input.email.toLowerCase().trim(),
        birthdate,
        gender: input.gender,
        instagramUsername: instagram,
        termsAcceptedAt: new Date(),
        category: 'bronze',
        profileCompletion: {
          create: {
            hasPhoto: false,
            hasInstagram,
            completionPercentage: computeProfileCompletion(false, hasInstagram),
          },
        },
      },
    });

    const session = await createSession(user, context);

    return {
      user: toPublicUser(user),
      access_token: session.accessToken,
      session_id: session.sessionId,
      expires_at: session.expiresAt,
      is_new_user: true,
      welcome: {
        title: `Welcome to YouPass, ${user.fullName.split(' ')[0]}!`,
        subtitle: 'Your access to the best events starts here',
        duration_seconds: 2,
      },
    };
  },

  async logout(user: User, sessionId: string) {
    await revokeSession(sessionId, user.id);
    return { message: 'Logged out successfully' };
  },

  async deleteAccountRequest(user: User, context?: OtpContext) {
    if (user.accountStatus !== 'active') {
      throw new AppError(403, AUTH_ERROR_CODES.UNAUTHORIZED, 'This account cannot be deleted');
    }

    const result = await createAndSendOtp(user.phone, user.countryCode, 'delete_account', context, false);
    const channel = otpDeliveryService.getChannel();

    return {
      message: `Account deletion code sent via ${otpChannelLabel(channel)}`,
      phone: user.phone,
      phone_display: result.phone_display,
      channel,
      expires_in_seconds: result.expires_in_seconds,
      resend_available_in_seconds: result.resend_available_in_seconds,
    };
  },

  async deleteAccountVerify(user: User, input: DeleteAccountVerifyInput, context?: OtpContext) {
    if (user.accountStatus !== 'active') {
      throw new AppError(403, AUTH_ERROR_CODES.UNAUTHORIZED, 'This account cannot be deleted');
    }

    await verifyOtpCode(user.phone, user.countryCode, input.code, 'delete_account', context);

    const deletedAt = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accountStatus: 'deleted',
        deletionRequestedAt: deletedAt,
        deletionScheduledAt: deletedAt,
        pendingPhoneChange: null,
      },
    });

    await revokeAllUserSessions(user.id);

    return {
      message: 'Your account has been deleted successfully',
      deleted_at: deletedAt.toISOString(),
    };
  },

  async changePhoneRequest(user: User, input: ChangePhoneRequestInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.new_phone, input.new_country_code);

    const taken = await prisma.user.findFirst({
      where: { phone: e164, id: { not: user.id } },
    });
    if (taken) {
      throw new AppError(409, AUTH_ERROR_CODES.USER_EXISTS, 'This phone number is already registered');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pendingPhoneChange: e164 },
    });

    const result = await createAndSendOtp(e164, countryCode, 'change_phone', context, false);
    const channel = otpDeliveryService.getChannel();

    return {
      message: `Code sent to the new number via ${otpChannelLabel(channel)}`,
      new_phone: e164,
      channel,
      ...result,
    };
  },

  async changePhoneVerify(user: User, input: ChangePhoneVerifyInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.new_phone, input.new_country_code);

    if (user.pendingPhoneChange !== e164) {
      throw new AppError(400, 'PHONE_MISMATCH', 'Phone number does not match the change request');
    }

    await verifyOtpCode(e164, countryCode, input.code, 'change_phone', context);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: e164,
        countryCode,
        pendingPhoneChange: null,
      },
    });

    return {
      message: 'Phone number updated successfully',
      user: toPublicUser(updated),
    };
  },

  async getWelcomeData(user: User) {
    const firstName = user.fullName.split(' ')[0] ?? user.fullName;
    return {
      title: `Welcome to YouPass, ${firstName}!`,
      subtitle: 'Your access to the best events starts here',
      duration_seconds: 2,
      user_name: firstName,
    };
  },
};

export type AuthService = typeof authService;
