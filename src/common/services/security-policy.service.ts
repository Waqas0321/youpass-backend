import { env } from '../../config/env.js';
import { isRecaptchaRequired } from './recaptcha.service.js';
import { GENDER_OPTIONS, SUPPORT_EMAIL, getAuthUiMessages } from '../constants/auth-messages.js';
import { POST_REGISTRATION_POLICY } from '../constants/post-registration-policy.js';
import { WHATSAPP_BUSINESS_PROFILE, whatsAppTemplateName } from '../constants/whatsapp-templates.js';
import { OTP_PURPOSE_LABELS } from '../../config/constants.js';

export function getAuthPolicy() {
  return {
    channel: 'whatsapp' as const,
    whatsapp_only: true,
    sms_enabled: false,
    passwordless: true,
    one_phone_one_account: true,
    support_email: SUPPORT_EMAIL,
    otp_length: env.OTP_LENGTH,
    otp_ttl_minutes: env.OTP_TTL_MINUTES,
    otp_resend_cooldown_seconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    otp_max_resends_per_hour: env.OTP_MAX_RESENDS_PER_HOUR,
    otp_max_failed_attempts: env.OTP_MAX_FAILED_ATTEMPTS,
    otp_block_minutes: env.OTP_BLOCK_MINUTES,
    session_indefinite: env.JWT_SESSION_INDEFINITE,
    session_expires_on_logout_only: env.JWT_SESSION_INDEFINITE,
  };
}

export function getSecurityPolicy() {
  const auth = getAuthPolicy();
  return {
    ...auth,
    jwt_expires_in: env.JWT_SESSION_INDEFINITE ? null : env.JWT_EXPIRES_IN,
    one_session_per_device: true,
    recaptcha_enabled: isRecaptchaRequired(),
    recaptcha_site_key: isRecaptchaRequired() ? env.RECAPTCHA_SITE_KEY || null : null,
    payment_tokenization_required: !env.ALLOW_LEGACY_CARD_INPUT,
    transport: 'https_only',
    otp_storage: 'hashed',
  };
}

export function getRegistrationPolicy() {
  return {
    required_fields: [
      'full_name',
      'rut_or_passport',
      'birthdate',
      'gender',
      'phone',
      'country_code',
      'code',
      'email',
      'accept_terms',
    ],
    optional_fields: ['instagram_username', 'preferred_language', 'profile_photo'],
    profile_photo_after_register: true,
    min_age_years: env.MIN_AGE_YEARS,
    gender_options: GENDER_OPTIONS,
    social_login_enabled: false,
    terms_url: 'https://youpass.app/terms',
    privacy_url: 'https://youpass.app/privacy',
  };
}

export function getPostRegistrationPolicy() {
  return POST_REGISTRATION_POLICY;
}

export function getWhatsAppTemplatePolicy() {
  return {
    business_profile: WHATSAPP_BUSINESS_PROFILE,
    templates: (Object.keys(OTP_PURPOSE_LABELS) as Array<keyof typeof OTP_PURPOSE_LABELS>).map(
      (purpose) => ({
        purpose,
        meta_name: whatsAppTemplateName(purpose),
      }),
    ),
    localization: ['es', 'pt', 'en'],
    language_selection: 'country_default',
  };
}

export function getAuthConfigBundle(languageCode = 'es') {
  return {
    auth: getAuthPolicy(),
    registration: getRegistrationPolicy(),
    post_registration: getPostRegistrationPolicy(),
    whatsapp: getWhatsAppTemplatePolicy(),
    commerce: getCommercePolicy(),
    security: getSecurityPolicy(),
    ui_messages: getAuthUiMessages(languageCode),
  };
}

export function getCommercePolicy() {
  return {
    countries: 'chile_and_latam',
    multi_currency: true,
    multi_language: true,
    language_source: 'country_default',
    gateways: { CL: 'klap', default: 'stripe' },
  };
}
