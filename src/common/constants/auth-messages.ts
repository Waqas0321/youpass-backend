import { env } from '../../config/env.js';

export const SUPPORT_EMAIL = 'soporte@youpass.app';

export function blockedMessage(minutes: number, languageCode = 'es'): string {
  if (languageCode === 'en') {
    return `Too many attempts. Wait ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  if (languageCode === 'pt') {
    return `Muitas tentativas. Aguarde ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
  }
  return `Demasiados intentos. Espera ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
}

export function bruteForceBlockedMessage(languageCode = 'es'): string {
  if (languageCode === 'en') {
    return `Too many failed attempts. Wait ${env.OTP_BLOCK_MINUTES} minutes.`;
  }
  if (languageCode === 'pt') {
    return `Muitas tentativas incorretas. Aguarde ${env.OTP_BLOCK_MINUTES} minutos.`;
  }
  return `Demasiados intentos fallidos. Espera ${env.OTP_BLOCK_MINUTES} minutos.`;
}

export function maxResendsMessage(minutes: number, languageCode = 'es'): string {
  if (languageCode === 'en') {
    return `You have reached the maximum resends. Wait ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  if (languageCode === 'pt') {
    return `Você atingiu o máximo de reenvios. Aguarde ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
  }
  return `Alcanzaste el máximo de reenvíos. Espera ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
}

export function underageMessage(languageCode = 'es'): string {
  if (languageCode === 'en') {
    return 'Sorry, YouPass is a platform exclusively for those over 18. If you think this is an error, check your date of birth.';
  }
  if (languageCode === 'pt') {
    return 'Desculpe, o YouPass é exclusivo para maiores de 18 anos. Se achar que é um erro, verifique sua data de nascimento.';
  }
  return 'Lo sentimos, YouPass es una plataforma exclusiva para mayores de 18 años. Si crees que es un error, revisa tu fecha de nacimiento.';
}

export function codeExpiredMessage(languageCode = 'es'): string {
  if (languageCode === 'en') {
    return 'The code expired. Request a new one.';
  }
  if (languageCode === 'pt') {
    return 'O código expirou. Solicite um novo.';
  }
  return 'El código expiró. Solicita uno nuevo.';
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
  const lang = languageCode === 'en' || languageCode === 'pt' ? languageCode : 'es';

  if (lang === 'en') {
    return {
      phone_incomplete: 'Please enter a valid number',
      phone_invalid_format: 'Check your number format',
      country_unsupported: 'YouPass does not operate in this country yet',
      blocked: blockedMessage(env.OTP_BLOCK_MINUTES, 'en'),
      brute_force_blocked: bruteForceBlockedMessage('en'),
      code_expired: codeExpiredMessage('en'),
      max_resends: maxResendsMessage(60, 'en'),
      underage: underageMessage('en'),
      whatsapp_help: whatsAppHelpMessage('en'),
      support_email: SUPPORT_EMAIL,
      change_number_confirm: "Are you sure? You'll go back to the start.",
    };
  }

  if (lang === 'pt') {
    return {
      phone_incomplete: 'Insira um número válido',
      phone_invalid_format: 'Verifique o formato do número',
      country_unsupported: 'O YouPass ainda não opera neste país',
      blocked: blockedMessage(env.OTP_BLOCK_MINUTES, 'pt'),
      brute_force_blocked: bruteForceBlockedMessage('pt'),
      code_expired: codeExpiredMessage('pt'),
      max_resends: maxResendsMessage(60, 'pt'),
      underage: underageMessage('pt'),
      whatsapp_help: whatsAppHelpMessage('pt'),
      support_email: SUPPORT_EMAIL,
      change_number_confirm: 'Tem certeza? Você voltará ao início.',
    };
  }

  return {
    phone_incomplete: 'Ingresa un número válido',
    phone_invalid_format: 'Revisa el formato del número',
    country_unsupported: 'YouPass aún no opera en este país',
    blocked: blockedMessage(env.OTP_BLOCK_MINUTES, 'es'),
    brute_force_blocked: bruteForceBlockedMessage('es'),
    code_expired: codeExpiredMessage('es'),
    max_resends: maxResendsMessage(60, 'es'),
    underage: underageMessage('es'),
    whatsapp_help: whatsAppHelpMessage('es'),
    support_email: SUPPORT_EMAIL,
    change_number_confirm: '¿Estás seguro? Volverás al inicio.',
  };
}

export const GENDER_OPTIONS = [
  { value: 'male', label_en: 'Male', label_es: 'Hombre', label_pt: 'Homem' },
  { value: 'female', label_en: 'Female', label_es: 'Mujer', label_pt: 'Mulher' },
  { value: 'other', label_en: 'Other', label_es: 'Otro', label_pt: 'Outro' },
] as const;
