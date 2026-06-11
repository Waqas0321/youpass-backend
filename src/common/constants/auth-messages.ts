import { env } from '../../config/env.js';

export const SUPPORT_EMAIL = 'soporte@youpass.app';

export function blockedMessage(minutes: number): string {
  return `Too many attempts. Wait ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export function bruteForceBlockedMessage(): string {
  return `Too many failed attempts. Wait ${env.OTP_BLOCK_MINUTES} minutes.`;
}

export function maxResendsMessage(minutes: number): string {
  return `You have reached the maximum resends. Wait ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export function underageMessage(): string {
  return 'Sorry, YouPass is a platform exclusively for those over 18. If you think this is an error, check your date of birth.';
}

export function codeExpiredMessage(): string {
  return 'The code expired. Request a new one.';
}

export function whatsAppHelpMessage(languageCode = 'es'): string {
  switch (languageCode) {
    case 'pt':
      return `Não recebeu o código? Verifique se o WhatsApp está instalado. O YouPass usa WhatsApp para enviar códigos de segurança. Problemas? ${SUPPORT_EMAIL}`;
    case 'en':
      return `Didn't get the code? Make sure WhatsApp is installed on your phone. YouPass uses WhatsApp to send security codes. If you have problems, contact support: ${SUPPORT_EMAIL}`;
    default:
      return `¿No recibiste el código? Asegúrate de tener WhatsApp instalado. YouPass usa WhatsApp para enviar códigos de seguridad. Si tienes problemas, contacta a soporte: ${SUPPORT_EMAIL}`;
  }
}

export function getAuthUiMessages(languageCode = 'es') {
  return {
    phone_incomplete: 'Please enter a valid number',
    phone_invalid_format: 'Check your number format',
    country_unsupported: 'YouPass does not operate in this country yet',
    blocked: blockedMessage(env.OTP_BLOCK_MINUTES),
    brute_force_blocked: bruteForceBlockedMessage(),
    code_expired: codeExpiredMessage(),
    max_resends: maxResendsMessage(60),
    underage: underageMessage(),
    whatsapp_help: whatsAppHelpMessage(languageCode),
    support_email: SUPPORT_EMAIL,
    change_number_confirm: "Are you sure? You'll go back to the start.",
  };
}

export const GENDER_OPTIONS = [
  { value: 'male', label_en: 'Man', label_es: 'Hombre', label_pt: 'Homem' },
  { value: 'female', label_en: 'Woman', label_es: 'Mujer', label_pt: 'Mulher' },
  { value: 'other', label_en: 'Other', label_es: 'Otro', label_pt: 'Outro' },
  {
    value: 'prefer_not_to_say',
    label_en: 'Prefer not to say',
    label_es: 'Prefiero no decir',
    label_pt: 'Prefiro não dizer',
  },
] as const;
