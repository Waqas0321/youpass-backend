import type { UserCategory } from '@prisma/client';

export const CATEGORY_BENEFITS: Record<
  UserCategory,
  { title_es: string; title_en: string; benefits_es: string[]; benefits_en: string[] }
> = {
  bronze: {
    title_es: 'Bronze',
    title_en: 'Bronze',
    benefits_es: [
      'Acceso a eventos públicos',
      'Compra de entradas estándar',
      'Invitaciones a eventos de amigos',
      'Soporte por WhatsApp en horario laboral',
    ],
    benefits_en: [
      'Access to public events',
      'Standard ticket purchases',
      'Invitations to friends\' events',
      'WhatsApp support during business hours',
    ],
  },
  silver: {
    title_es: 'Silver',
    title_en: 'Silver',
    benefits_es: [
      'Todo lo de Bronze',
      'Acceso anticipado a preventas selectas',
      'Prioridad en lista de espera',
      'Descuentos exclusivos en eventos partner',
      'Badge Silver en tu perfil',
    ],
    benefits_en: [
      'Everything in Bronze',
      'Early access to select presales',
      'Waitlist priority',
      'Exclusive discounts at partner events',
      'Silver badge on your profile',
    ],
  },
  gold: {
    title_es: 'Gold',
    title_en: 'Gold',
    benefits_es: [
      'Todo lo de Silver',
      'Acceso VIP a lanzamientos',
      'Invitaciones a eventos exclusivos YouPass',
      'Atención prioritaria en soporte',
      'Beneficios en mesas VIP seleccionadas',
      'Badge Gold en tu perfil',
    ],
    benefits_en: [
      'Everything in Silver',
      'VIP access to launches',
      'Invitations to exclusive YouPass events',
      'Priority support',
      'Benefits on select VIP tables',
      'Gold badge on your profile',
    ],
  },
};
