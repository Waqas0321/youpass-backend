export type FaqCategory =
  | 'ticket_purchasing'
  | 'nominal_assignment'
  | 'door_validation'
  | 'party_mode'
  | 'vip_tables'
  | 'payments_refunds'
  | 'my_account'
  | 'categories_points'
  | 'terms_privacy';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question_es: string;
  question_en: string;
  answer_es: string;
  answer_en: string;
  keywords: string[];
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-buy-tickets',
    category: 'ticket_purchasing',
    question_es: '¿Cómo compro entradas en YouPass?',
    question_en: 'How do I buy tickets on YouPass?',
    answer_es:
      'Desde la ficha del evento, elige el tipo de entrada, completa el pago con tu tarjeta guardada o agrega una nueva, y recibirás la confirmación por email y WhatsApp.',
    answer_en:
      'From the event page, choose your ticket type, complete payment with a saved card or add a new one, and you will receive confirmation by email and WhatsApp.',
    keywords: ['comprar', 'entrada', 'ticket', 'buy'],
  },
  {
    id: 'faq-assign-nominal',
    category: 'nominal_assignment',
    question_es: '¿Cómo asigno entradas nominales a mis invitados?',
    question_en: 'How do I assign nominal tickets to my guests?',
    answer_es:
      'Tras comprar entradas nominales, ve a Mis Tickets > Asignar y envía la invitación por WhatsApp. Cada invitado debe confirmar con su cuenta YouPass.',
    answer_en:
      'After buying nominal tickets, go to My Tickets > Assign and send the invitation via WhatsApp. Each guest must confirm with their YouPass account.',
    keywords: ['asignar', 'nominal', 'invitado', 'assign'],
  },
  {
    id: 'faq-door-qr',
    category: 'door_validation',
    question_es: '¿Cuándo puedo ver el código QR de mi entrada?',
    question_en: 'When can I see my ticket QR code?',
    answer_es:
      'El QR se habilita cuando el organizador lo activa, generalmente horas antes del evento. Recibirás una notificación push cuando esté disponible.',
    answer_en:
      'The QR is enabled when the organizer activates it, usually hours before the event. You will receive a push notification when it is available.',
    keywords: ['qr', 'puerta', 'validación', 'door'],
  },
  {
    id: 'faq-party-mode',
    category: 'party_mode',
    question_es: '¿Qué es Party Mode?',
    question_en: 'What is Party Mode?',
    answer_es:
      'Party Mode agrupa a tus amigos que asisten al mismo evento para coordinar llegada, mesas VIP y experiencias compartidas dentro de la app.',
    answer_en:
      'Party Mode groups your friends attending the same event to coordinate arrival, VIP tables, and shared experiences inside the app.',
    keywords: ['party', 'modo', 'amigos', 'friends'],
  },
  {
    id: 'faq-vip-tables',
    category: 'vip_tables',
    question_es: '¿Cómo reservo una mesa VIP?',
    question_en: 'How do I book a VIP table?',
    answer_es:
      'En eventos con mesas VIP, abre el plano del venue, selecciona zona y mesa disponible, y completa el pago. La mesa queda bloqueada temporalmente mientras pagas.',
    answer_en:
      'On events with VIP tables, open the venue floor plan, select an available zone and table, and complete payment. The table is temporarily locked while you pay.',
    keywords: ['vip', 'mesa', 'table', 'reserva'],
  },
  {
    id: 'faq-refunds',
    category: 'payments_refunds',
    question_es: '¿Cómo solicito un reembolso?',
    question_en: 'How do I request a refund?',
    answer_es:
      'Los reembolsos dependen de la política del evento. Contacta soporte por WhatsApp con tu número de orden. Los reembolsos procesados se envían al mismo medio de pago.',
    answer_en:
      'Refunds depend on the event policy. Contact support via WhatsApp with your order number. Processed refunds are sent to the same payment method.',
    keywords: ['reembolso', 'refund', 'devolución', 'pago'],
  },
  {
    id: 'faq-change-profile',
    category: 'my_account',
    question_es: '¿Puedo editar mis datos personales?',
    question_en: 'Can I edit my personal data?',
    answer_es:
      'Sí. En Mi Perfil > Datos personales puedes editar nombre, email, fecha de nacimiento, género e Instagram. El teléfono solo se cambia desde Cambiar teléfono.',
    answer_en:
      'Yes. In My Profile > Personal data you can edit name, email, date of birth, gender, and Instagram. Phone can only be changed via Change phone.',
    keywords: ['perfil', 'datos', 'editar', 'profile'],
  },
  {
    id: 'faq-categories',
    category: 'categories_points',
    question_es: '¿Cómo subo de categoría Bronze, Silver o Gold?',
    question_en: 'How do I move up Bronze, Silver, or Gold categories?',
    answer_es:
      'Acumulas puntos asistiendo a eventos, confirmando invitaciones y completando tu perfil. Revisa "Ver mis beneficios" en Mi Perfil para ver ventajas por nivel.',
    answer_en:
      'You earn points by attending events, confirming invitations, and completing your profile. Check "View my benefits" in My Profile for tier perks.',
    keywords: ['categoría', 'puntos', 'bronze', 'gold', 'silver'],
  },
  {
    id: 'faq-privacy',
    category: 'terms_privacy',
    question_es: '¿Cómo manejan mis datos personales?',
    question_en: 'How do you handle my personal data?',
    answer_es:
      'YouPass cumple la Ley 19.628 de Chile y GDPR. Puedes solicitar eliminación de cuenta; algunos registros transaccionales se conservan anonimizados por obligación legal.',
    answer_en:
      'YouPass complies with Chilean Law 19.628 and GDPR. You can request account deletion; some transactional records are kept anonymized for legal compliance.',
    keywords: ['privacidad', 'datos', 'términos', 'privacy', 'gdpr'],
  },
];

export const FAQ_CATEGORIES: { id: FaqCategory; label_es: string; label_en: string }[] = [
  { id: 'ticket_purchasing', label_es: 'Compra de entradas', label_en: 'Ticket purchasing' },
  { id: 'nominal_assignment', label_es: 'Asignación nominal', label_en: 'Nominal assignment' },
  { id: 'door_validation', label_es: 'Validación en puerta', label_en: 'Door validation' },
  { id: 'party_mode', label_es: 'Party Mode', label_en: 'Party Mode' },
  { id: 'vip_tables', label_es: 'Mesas VIP', label_en: 'VIP tables' },
  { id: 'payments_refunds', label_es: 'Pagos y reembolsos', label_en: 'Payments and refunds' },
  { id: 'my_account', label_es: 'Mi cuenta', label_en: 'My account' },
  { id: 'categories_points', label_es: 'Categorías y puntos', label_en: 'Categories and points' },
  { id: 'terms_privacy', label_es: 'Términos y Privacidad', label_en: 'Terms and Privacy' },
];
