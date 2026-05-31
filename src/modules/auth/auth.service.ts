import type { AuthCodePurpose, User } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { AUTH_ERROR_CODES, WHATSAPP_TEMPLATES } from '../../config/constants.js';
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
import { whatsappService } from './whatsapp.service.js';
import { createSession, revokeSession } from './session.service.js';
import type {
  ChangePhoneRequestInput,
  ChangePhoneVerifyInput,
  LoginInput,
  RegisterInput,
  SendCodeInput,
  VerifyCodeInput,
} from './auth.validators.js';

type OtpContext = AuthRequestContext | undefined;

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
      `Demasiados intentos. Espera ${minutes} minutos.`,
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
      `Demasiados intentos fallidos. Espera ${env.OTP_BLOCK_MINUTES} minutos.`,
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
        `Reenviar código en ${secondsUntil(cooldownEnds)} segundos`,
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
      `Has alcanzado el máximo de reenvíos. Espera ${minutesUntil(resetAt)} minutos.`,
      { retry_after_seconds: secondsUntil(resetAt) },
    );
  }
}

async function invalidatePreviousCodes(phone: string, purpose: AuthCodePurpose): Promise<void> {
  await prisma.authCode.updateMany({
    where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
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

  if (purpose === 'login' && !existingUser) {
    throw new AppError(404, AUTH_ERROR_CODES.USER_NOT_FOUND, 'No encontramos una cuenta con este número');
  }

  if (purpose === 'register' && existingUser) {
    throw new AppError(409, AUTH_ERROR_CODES.USER_EXISTS, 'Ya existe una cuenta con este número');
  }

  if (purpose === 'login' && existingUser?.accountStatus !== 'active') {
    throw new AppError(403, AUTH_ERROR_CODES.UNAUTHORIZED, 'Esta cuenta no está activa');
  }

  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  const code = generateOtp(env.OTP_LENGTH);
  const codeHash = await hashOtp(code);
  const expiresAt = addMinutes(new Date(), env.OTP_TTL_MINUTES);

  await invalidatePreviousCodes(e164, purpose);

  await prisma.authCode.create({
    data: {
      phone: e164,
      codeHash,
      purpose,
      countryCode,
      expiresAt,
      whatsappTemplate: WHATSAPP_TEMPLATES[purpose],
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

  await whatsappService.sendOtp({
    phone: e164,
    purpose,
    code,
    languageCode: country?.languageCode,
  });

  if (env.NODE_ENV === 'development') {
    console.log(`[DEV OTP] ${e164} purpose=${purpose} code=${code}`);
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
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!authCode) {
    await incrementFailedAttempt(e164);
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Código inválido');
  }

  if (authCode.expiresAt <= new Date()) {
    throw new AppError(400, AUTH_ERROR_CODES.CODE_EXPIRED, 'El código expiró. Solicita uno nuevo.');
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
    throw new AppError(400, AUTH_ERROR_CODES.INVALID_CODE, 'Código incorrecto');
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
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const result = await createAndSendOtp(e164, countryCode, input.purpose, context, false);
    return {
      message: 'Código enviado por WhatsApp',
      phone: e164,
      purpose: input.purpose,
      channel: 'whatsapp' as const,
      ...result,
    };
  },

  async resendCode(input: SendCodeInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    const result = await createAndSendOtp(e164, countryCode, input.purpose, context, true);
    return {
      message: 'Código reenviado por WhatsApp',
      phone: e164,
      purpose: input.purpose,
      channel: 'whatsapp' as const,
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
      message: 'Código verificado correctamente',
    };
  },

  async checkWhatsApp(input: { phone: string; country_code: string }) {
    const { e164 } = await parseAndValidatePhone(input.phone, input.country_code);
    const available = await whatsappService.checkWhatsAppAvailable(e164);
    return {
      phone: e164,
      whatsapp_available: available,
      message: available
        ? 'Número compatible con WhatsApp'
        : 'Asegúrate de tener WhatsApp instalado en tu teléfono',
    };
  },

  async login(input: LoginInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.phone, input.country_code);
    await verifyOtpCode(e164, countryCode, input.code, 'login', context);

    const user = await prisma.user.findUnique({ where: { phone: e164 } });
    if (!user || user.accountStatus !== 'active') {
      throw new AppError(404, AUTH_ERROR_CODES.USER_NOT_FOUND, 'No encontramos una cuenta con este número');
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
      throw new AppError(409, AUTH_ERROR_CODES.USER_EXISTS, 'Ya existe una cuenta con este número');
    }

    const birthdate = new Date(input.birthdate);
    if (Number.isNaN(birthdate.getTime())) {
      throw new AppError(400, 'INVALID_BIRTHDATE', 'Fecha de nacimiento inválida');
    }

    if (calculateAge(birthdate) < env.MIN_AGE_YEARS) {
      throw new AppError(
        403,
        AUTH_ERROR_CODES.UNDERAGE,
        'YouPass es una plataforma exclusiva para mayores de 18 años.',
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
        title: `¡Bienvenido a YouPass, ${user.fullName.split(' ')[0]}!`,
        subtitle: 'Tu acceso a los mejores eventos comienza aquí',
        duration_seconds: 2,
      },
    };
  },

  async logout(user: User, sessionId: string) {
    await revokeSession(sessionId, user.id);
    return { message: 'Sesión cerrada correctamente' };
  },

  async changePhoneRequest(user: User, input: ChangePhoneRequestInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.new_phone, input.new_country_code);

    const taken = await prisma.user.findFirst({
      where: { phone: e164, id: { not: user.id } },
    });
    if (taken) {
      throw new AppError(409, AUTH_ERROR_CODES.USER_EXISTS, 'Este número ya está registrado');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pendingPhoneChange: e164 },
    });

    const result = await createAndSendOtp(e164, countryCode, 'change_phone', context, false);

    return {
      message: 'Código enviado al nuevo número por WhatsApp',
      new_phone: e164,
      ...result,
    };
  },

  async changePhoneVerify(user: User, input: ChangePhoneVerifyInput, context?: OtpContext) {
    const { e164, countryCode } = await parseAndValidatePhone(input.new_phone, input.new_country_code);

    if (user.pendingPhoneChange !== e164) {
      throw new AppError(400, 'PHONE_MISMATCH', 'El número no coincide con la solicitud de cambio');
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
      message: 'Número de teléfono actualizado',
      user: toPublicUser(updated),
    };
  },

  async getWelcomeData(user: User) {
    const firstName = user.fullName.split(' ')[0] ?? user.fullName;
    return {
      title: `¡Bienvenido a YouPass, ${firstName}!`,
      subtitle: 'Tu acceso a los mejores eventos comienza aquí',
      duration_seconds: 2,
      user_name: firstName,
    };
  },
};

export type AuthService = typeof authService;
