import type { AuthCodePurpose } from '@prisma/client';
import { OTP_PURPOSE_LABELS } from '../../config/constants.js';
import { SUPPORT_EMAIL } from './auth-messages.js';

export type WhatsAppLanguage = 'es' | 'pt' | 'en';

export function resolveWhatsAppLanguage(languageCode?: string): WhatsAppLanguage {
  if (languageCode === 'pt') return 'pt';
  if (languageCode === 'en') return 'en';
  return 'es';
}

/** Meta template names stored on auth_codes.whatsapp_template */
export function whatsAppTemplateName(purpose: AuthCodePurpose): string {
  return OTP_PURPOSE_LABELS[purpose];
}

/**
 * Body text for OTP WhatsApp messages (Meta-approved template copy).
 * Variable {{1}} = 6-digit OTP code.
 */
export function buildWhatsAppOtpBody(
  purpose: AuthCodePurpose,
  code: string,
  languageCode?: string,
): string {
  const lang = resolveWhatsAppLanguage(languageCode);
  const templates: Record<WhatsAppLanguage, Record<AuthCodePurpose, string>> = {
    es: {
      login: `Hola 👋 Tu código de verificación para iniciar sesión en YouPass es: ${code}. Este código es válido por 3 minutos. Si no fuiste tú, puedes ignorar este mensaje. — YouPass`,
      register: `¡Bienvenido a YouPass! Tu código de verificación para crear tu cuenta es: ${code}. Este código es válido por 3 minutos. — YouPass`,
      change_phone: `Confirmación de cambio de teléfono. Tu código para validar tu nuevo número en YouPass es: ${code}. Válido por 3 minutos. Si no solicitaste este cambio, contacta a soporte de inmediato: ${SUPPORT_EMAIL} — YouPass`,
      delete_account: `Confirmación de eliminación. Tu código para confirmar la eliminación de tu cuenta YouPass es: ${code}. Válido por 3 minutos. Si no solicitaste eliminar tu cuenta, ignora este mensaje y contacta a soporte de inmediato: ${SUPPORT_EMAIL} — YouPass`,
    },
    pt: {
      login: `Olá 👋 Seu código de verificação para entrar no YouPass é: ${code}. Este código é válido por 3 minutos. Se não foi você, ignore esta mensagem. — YouPass`,
      register: `Bem-vindo ao YouPass! Seu código de verificação para criar sua conta é: ${code}. Este código é válido por 3 minutos. — YouPass`,
      change_phone: `Confirmação de troca de telefone. Seu código para validar seu novo número no YouPass é: ${code}. Válido por 3 minutos. Se você não solicitou esta alteração, entre em contato com o suporte imediatamente: ${SUPPORT_EMAIL} — YouPass`,
      delete_account: `Confirmação de exclusão. Seu código para confirmar a exclusão da sua conta YouPass é: ${code}. Válido por 3 minutos. Se você não solicitou excluir sua conta, ignore esta mensagem e entre em contato com o suporte imediatamente: ${SUPPORT_EMAIL} — YouPass`,
    },
    en: {
      login: `Hi 👋 Your verification code to sign in to YouPass is: ${code}. This code is valid for 3 minutes. If it wasn't you, you can ignore this message. — YouPass`,
      register: `Welcome to YouPass! Your verification code to create your account is: ${code}. This code is valid for 3 minutes. — YouPass`,
      change_phone: `Phone change confirmation. Your code to validate your new number on YouPass is: ${code}. Valid for 3 minutes. If you did not request this change, contact support immediately: ${SUPPORT_EMAIL} — YouPass`,
      delete_account: `Deletion confirmation. Your code to confirm deleting your YouPass account is: ${code}. Valid for 3 minutes. If you did not request to delete your account, ignore this message and contact support immediately: ${SUPPORT_EMAIL} — YouPass`,
    },
  };

  return templates[lang][purpose];
}

export const WHATSAPP_BUSINESS_PROFILE = {
  verified: true,
  category: 'Events and Entertainment',
  bio_es:
    'YouPass® (verificado) — Cuenta oficial de la empresa. Categoría: Eventos y Entretenimiento. YouPass es la app líder de ticketing para fiestas, conciertos y eventos exclusivos. Tu acceso digital, seguro y simple. youpass.app · soporte@youpass.app · Lun-Dom 10:00-22:00',
  bio_en:
    'YouPass® (verified) — Official company account. Category: Events and Entertainment. YouPass is the leading ticketing app for parties, concerts and exclusive events. Your digital, secure and simple access. youpass.app · soporte@youpass.app · Mon-Sun 10:00-22:00',
  support_email: SUPPORT_EMAIL,
  website: 'https://youpass.app',
  hours: 'Mon-Sun 10:00-22:00',
} as const;
