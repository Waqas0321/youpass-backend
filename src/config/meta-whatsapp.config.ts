import type { AuthCodePurpose } from '@prisma/client';
import { resolveWhatsAppLanguage } from '../common/constants/whatsapp-templates.js';
import { env } from './env.js';

export function isMetaWhatsAppProvider(): boolean {
  return env.WHATSAPP_PROVIDER === 'meta';
}

export function hasMetaWhatsAppCredentials(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function metaGraphApiBaseUrl(): string {
  return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
}

export function metaOtpTemplateName(purpose: AuthCodePurpose): string {
  const byPurpose: Record<AuthCodePurpose, string> = {
    login: env.WHATSAPP_TEMPLATE_LOGIN,
    register: env.WHATSAPP_TEMPLATE_REGISTER,
    change_phone: env.WHATSAPP_TEMPLATE_PHONE_CHANGE,
    delete_account: env.WHATSAPP_TEMPLATE_DELETE_ACCOUNT,
    staff_login: env.WHATSAPP_TEMPLATE_STAFF_LOGIN,
  };
  return (byPurpose[purpose] || env.WHATSAPP_OTP_TEMPLATE_NAME).trim();
}

const META_TEMPLATE_LANGUAGE: Record<'es' | 'en' | 'pt', string> = {
  es: 'es',
  en: 'en_US',
  pt: 'pt_BR',
};

export function resolveMetaOtpTemplateLanguage(languageCode?: string): string {
  const configured = env.WHATSAPP_OTP_TEMPLATE_LANGUAGE.trim();
  if (configured) {
    return configured;
  }
  return META_TEMPLATE_LANGUAGE[resolveWhatsAppLanguage(languageCode)];
}

export function metaOtpTemplateLanguage(languageCode?: string): string {
  return resolveMetaOtpTemplateLanguage(languageCode);
}

export function logMetaWhatsAppStartupSummary(): void {
  if (!isMetaWhatsAppProvider()) return;

  const mode = env.WHATSAPP_MOCK ? 'MOCK' : hasMetaWhatsAppCredentials() ? 'LIVE' : 'NOT_CONFIGURED';
  const template = env.WHATSAPP_OTP_TEMPLATE_NAME || '(not set)';
  console.log(
    `[Meta WhatsApp] mode=${mode} phone_number_id=${env.WHATSAPP_PHONE_NUMBER_ID || '(not set)'} otp_template=${template}`,
  );
  if (!env.WHATSAPP_MOCK && !env.WHATSAPP_OTP_TEMPLATE_NAME) {
    console.warn(
      '[Meta WhatsApp] WHATSAPP_OTP_TEMPLATE_NAME is not set — OTP sends will fail until an Authentication template is approved.',
    );
  }
}

export function isWhatsAppDeliveryMock(): boolean {
  if (isMetaWhatsAppProvider()) {
    return env.WHATSAPP_MOCK;
  }
  return env.TWILIO_MOCK;
}
