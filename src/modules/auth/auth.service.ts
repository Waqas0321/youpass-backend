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
import { getActiveCountry } from '../../common/services/country-config.service.js';
import { verifyRecaptchaToken } from '../../common/services/recaptcha.service.js';
import type { AuthRequestContext } from '../../common/types/auth.js';
import {
  blockedMessage,
  bruteForceBlockedMessage,
  codeExpiredMessage,
  maxResendsMessage,
  underageMessage,
} from '../../common/constants/auth-messages.js';
import { otpDeliveryService, whatsAppReadyMessage, whatsAppUnavailableMessage } from './otp-delivery.service.js';
import { linkPendingInvitationsByPhone } from '../invitations/invitation-link.service.js';

function isSessionEligibleAccountStatus(status: User['accountStatus']): boolean {
  return status === 'active' || status === 'pending_deletion';
}

function otpBlockMinutesForPurpose(purpose: AuthCodePurpose): number {
  return purpose === 'delete_account'
    ? env.DELETE_ACCOUNT_OTP_BLOCK_MINUTES
    : env.OTP_BLOCK_MINUTES;
}
import {
  buildPostRegistrationNavigation,
  buildWelcomePayload,
} from '../../common/constants/post-registration-policy.js';
import { migrateUserPhoneData } from './phone-migration.service.js';
import { createSession, revokeSession } from './session.service.js';
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

function otpChannelLabel(_channel: 'whatsapp'): string {
  return 'WhatsApp';
}

function sentViaForChannel(_channel: 'whatsapp'): 'whatsapp' {
  return 'whatsapp';
}

function otpPolicyMeta() {
  return {
    channel: 'whatsapp' as const,
    otp_length: env.OTP_LENGTH,
    expires_in_seconds: env.OTP_TTL_MINUTES * 60,
    resend_available_in_seconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    max_resends_per_hour: env.OTP_MAX_RESENDS_PER_HOUR,
    max_failed_attempts: env.OTP_MAX_FAILED_ATTEMPTS,
    block_minutes: env.OTP_BLOCK_MINUTES,
  };
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

async function incrementFailedAttempt(
  phone: string,
  blockMinutes = env.OTP_BLOCK_MINUTES,
): Promise<void> {
  const limit = await getOrCreateRateLimit(phone);
  const failedAttempts = limit.failedAttempts + 1;
  const blockedUntil =
    failedAttempts >= env.OTP_MAX_FAILED_ATTEMPTS
      ? addMinutes(new Date(), blockMinutes)
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
      { retry_after_seconds: blockMinutes * 60 },
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

  if (existingUser.accountStatus !== 'active' && existingUser.accountStatus !== 'pending_deletion') {
    throw new AppError(403, AUTH_ERROR_CODES.UNAUTHORIZED, 'This account is not active');
  }

  return { purpose: 'login', accountExists: true };
}

function mapTwilioDeliveryError(err: unknown): AppError {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes('TWILIO_WHATSAPP_FROM is not set') || raw.includes('credentials missing')) {
    return new AppError(
      503,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      raw.includes('credentials missing')
        ? 'Twilio is not configured on the server. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel, then redeploy.'
        : 'WhatsApp sender is not configured. Set TWILIO_WHATSAPP_FROM in Vercel (sandbox: +14155238886), then redeploy.',
    );
  }

  if (raw.includes('63038')) {
    return new AppError(
      429,
      AUTH_ERROR_CODES.RATE_LIMITED,
      'Daily WhatsApp message limit reached on Twilio trial. Try again tomorrow or upgrade your Twilio account.',
    );
  }

  if (raw.includes('TWILIO_WHATSAPP_OTP_CONTENT_SID') || raw.includes('INVITATION_CONTENT_SID')) {
    return new AppError(
      503,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      raw,
    );
  }

  if (raw.includes('63016')) {
    return new AppError(
      502,
      AUTH_ERROR_CODES.OTP_DELIVERY_FAILED,
      'WhatsApp template not approved yet. Join the Twilio sandbox from your phone (send join <code> to +1 415 523 8886), then try again.',
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
    `Failed to send the code via WhatsApp. Try again later.`,
  );
}

async function createAndSendOtp(
  e164: string,
  countryCode: string,
  purpose: AuthCodePurpose,
  _context?: OtpContext,
  isResend = false,
): Promise<{
  expires_in_seconds: number;
  resend_available_in_seconds: number;
  phone_display: string;
  dev_otp_code?: string;
}> {
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
    throw mapTwilioDeliveryError(err);
  }

  if (env.TWILIO_MOCK || env.NODE_ENV === 'development') {
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(`[DEV OTP] phone=${e164} purpose=${purpose} code=${code}`);
    console.log('════════════════════════════════════════');
    console.log('');
  }

  return {
    phone_display: formatPhoneDisplay(e164, countryCode),
    ...otpPolicyMeta(),
    ...(env.TWILIO_MOCK ? { dev_otp_code: code } : {}),
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
    const limit = await getOrCreateRateLimit(e164);
    const attemptsAfter = limit.failedAttempts + 1;
    const remainingAttempts = Math.max(0, env.OTP_MAX_FAILED_ATTEMPTS - attemptsAfter);
    const blockMinutes = otpBlockMinutesForPurpose(purpose);
    await incrementFailedAttempt(e164, blockMinutes);
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
    const blockMinutes = otpBlockMinutesForPurpose(purpose);
    await incrementFailedAttempt(e164, blockMinutes);
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Incorrect code', {
      remaining_attempts: remainingAttempts,
    });
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

    await verifyRecaptchaToken(input.recaptcha_token, 'send_code');

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

    const { purpose, accountExists } = await resolveSendCodePurpose(e164, input.purpose);
    const result = await createAndSendOtp(e164, countryCode, purpose, context, false);
    const channel = otpDeliveryService.getChannel();
    return {
      message: `Code sent via ${otpChannelLabel(channel)}. ${whatsAppReadyMessage(country.languageCode)}`,
      phone: e164,
      purpose,
      ...(accountExists !== undefined ? { account_exists: accountExists } : {}),
      channel,
      whatsapp_available: true,
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

    await verifyRecaptchaToken(input.recaptcha_token, 'resend_code');

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

    const { purpose, accountExists } = await resolveSendCodePurpose(e164, input.purpose);
    const result = await createAndSendOtp(e164, countryCode, purpose, context, true);
    const channel = otpDeliveryService.getChannel();
    return {
      message: `Code resent via ${otpChannelLabel(channel)}`,
      phone: e164,
      purpose,
      ...(accountExists !== undefined ? { account_exists: accountExists } : {}),
      channel,
      whatsapp_available: true,
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
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const country = await getActiveCountry(countryCode);
    const available = await otpDeliveryService.checkWhatsAppAvailable(e164);
    return {
      phone: e164,
      whatsapp_available: available,
      can_receive_otp: available,
      delivery_channel: 'whatsapp',
      auth_channel: 'whatsapp_only',
      sms_enabled: false,
      message: available
        ? whatsAppReadyMessage(country.languageCode)
        : whatsAppUnavailableMessage(country.languageCode),
      message_key: available ? 'WHATSAPP_READY' : 'WHATSAPP_REQUIRED',
    };
  },

  async login(input: LoginInput, context?: OtpContext) {
    await verifyRecaptchaToken(input.recaptcha_token, 'login');

    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    await verifyOtpCode(e164, countryCode, input.code, 'login', context);

    const user = await prisma.user.findUnique({ where: { phone: e164 } });
    if (!user || !isSessionEligibleAccountStatus(user.accountStatus)) {
      throw new AppError(404, AUTH_ERROR_CODES.USER_NOT_FOUND, 'No account found for this phone number');
    }

    const linkedInvitations = await linkPendingInvitationsByPhone(user.id, e164);
    const session = await createSession(user, context);

    return {
      user: toPublicUser(user),
      access_token: session.accessToken,
      session_id: session.sessionId,
      expires_at: session.expiresAt,
      session_indefinite: env.JWT_SESSION_INDEFINITE,
      is_new_user: false,
      linked_invitations: linkedInvitations,
    };
  },

  async register(input: RegisterInput, context?: OtpContext) {
    await verifyRecaptchaToken(input.recaptcha_token, 'register');

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
        underageMessage(),
      );
    }

    const instagram = input.instagram_username?.replace(/^@/, '') ?? null;
    const hasInstagram = Boolean(instagram);
    const country = await getActiveCountry(countryCode);

    const user = await prisma.user.create({
      data: {
        phone: e164,
        countryCode,
        preferredLanguage: input.preferred_language ?? country.languageCode,
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

    const linkedInvitations = await linkPendingInvitationsByPhone(user.id, e164);
    const session = await createSession(user, context);

    return {
      user: toPublicUser(user),
      access_token: session.accessToken,
      session_id: session.sessionId,
      expires_at: session.expiresAt,
      session_indefinite: env.JWT_SESSION_INDEFINITE,
      is_new_user: true,
      linked_invitations: linkedInvitations,
      welcome: buildWelcomePayload(user.fullName),
      navigation: buildPostRegistrationNavigation(linkedInvitations),
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

    const requestedAt = new Date();
    const scheduledAt = new Date(requestedAt);
    scheduledAt.setDate(scheduledAt.getDate() + env.ACCOUNT_DELETION_COOLING_DAYS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accountStatus: 'pending_deletion',
        deletionRequestedAt: requestedAt,
        deletionScheduledAt: scheduledAt,
        pendingPhoneChange: null,
      },
    });

    return {
      message:
        `Your account is scheduled for deletion in ${env.ACCOUNT_DELETION_COOLING_DAYS} days. You can cancel anytime before then.`,
      status: 'pending_deletion',
      deletion_requested_at: requestedAt.toISOString(),
      deletion_scheduled_at: scheduledAt.toISOString(),
      days_remaining: env.ACCOUNT_DELETION_COOLING_DAYS,
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

    const oldPhone = user.phone;
    const migration = await migrateUserPhoneData(user.id, oldPhone, e164);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: e164,
        countryCode,
        pendingPhoneChange: null,
        preferredLanguage: user.preferredLanguage ?? (await getActiveCountry(countryCode)).languageCode,
      },
    });

    return {
      message: 'Phone number updated successfully',
      user: toPublicUser(updated),
      migration,
    };
  },

  async getWelcomeData(user: User) {
    return buildWelcomePayload(user.fullName);
  },
};

export type AuthService = typeof authService;
