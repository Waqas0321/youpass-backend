export type RegisteredProducerStatus = 'active' | 'inactive';

export type RegisteredProducer = {
  id: string;
  name: string;
  city: string;
  country: string;
  status: RegisteredProducerStatus;
  logoColor: string;
  logoLabel: string;
};

export const REGISTERED_PRODUCERS_DATE_RANGE = {
  start: '2026-01-25',
  end: '2026-01-31',
};

export const registeredProducersCatalog: RegisteredProducer[] = [
  {
    id: 'lotus',
    name: 'Lotus Producciones SpA',
    city: 'Santiago',
    country: 'Chile',
    status: 'active',
    logoColor: '#7c3aed',
    logoLabel: 'Lotus',
  },
  {
    id: 'altiplano',
    name: 'Altiplano Eventos Ltda.',
    city: 'Antofagasta',
    country: 'Chile',
    status: 'active',
    logoColor: '#0ea5e9',
    logoLabel: 'Altiplano',
  },
  {
    id: 'pulso',
    name: 'Pulso Producciones',
    city: 'Valparaíso',
    country: 'Chile',
    status: 'active',
    logoColor: '#ec4899',
    logoLabel: 'Pulso',
  },
  {
    id: 'nexo',
    name: 'Nexo Entertainment SpA',
    city: 'Concepción',
    country: 'Chile',
    status: 'active',
    logoColor: '#22c55e',
    logoLabel: 'Nexo',
  },
  {
    id: 'sur-beat',
    name: 'Sur Beat Producciones',
    city: 'Temuco',
    country: 'Chile',
    status: 'active',
    logoColor: '#f97316',
    logoLabel: 'Sur Beat',
  },
  {
    id: 'aurora',
    name: 'Aurora Live SpA',
    city: 'La Serena',
    country: 'Chile',
    status: 'active',
    logoColor: '#a855f7',
    logoLabel: 'Aurora',
  },
  {
    id: 'rumbo',
    name: 'Rumbo Festival Ltda.',
    city: 'Rancagua',
    country: 'Chile',
    status: 'inactive',
    logoColor: '#64748b',
    logoLabel: 'Rumbo',
  },
  {
    id: 'costa-norte',
    name: 'Costa Norte Events',
    city: 'Iquique',
    country: 'Chile',
    status: 'active',
    logoColor: '#14b8a6',
    logoLabel: 'Costa Norte',
  },
];

export function filterRegisteredProducers(producers: RegisteredProducer[], query: string) {
  const term = query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  if (!term) {
    return producers;
  }

  return producers.filter((producer) => {
    const haystack = [producer.name, producer.city, producer.country, producer.logoLabel]
      .join(' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    return haystack.includes(term);
  });
}

export type ProducerContact = {
  name: string;
  phone: string;
};

export type RegisteredProducerDetail = {
  owner: ProducerContact;
  generalProducers: ProducerContact[];
  email: string;
  accessKey: string;
};

const PRODUCER_DETAILS: Record<string, RegisteredProducerDetail> = {
  lotus: {
    owner: { name: 'Carlos Martínez', phone: '+56 9 8765 4321' },
    generalProducers: [
      { name: 'Alejandra Rojas', phone: '+56 9 3344 1122' },
      { name: 'Tomás Fuentes', phone: '+56 9 6677 8899' },
    ],
    email: 'contacto@lotusproducciones.cl',
    accessKey: 'YP-8K2M-41QX',
  },
  altiplano: {
    owner: { name: 'Patricia Soto', phone: '+56 9 7654 3210' },
    generalProducers: [{ name: 'Diego Morales', phone: '+56 9 5544 7788' }],
    email: 'hola@altiplanoeventos.cl',
    accessKey: 'YP-3N7P-92LM',
  },
  pulso: {
    owner: { name: 'Valentina Cruz', phone: '+56 9 6123 4567' },
    generalProducers: [
      { name: 'Matías Herrera', phone: '+56 9 4455 6677' },
      { name: 'Camila Reyes', phone: '+56 9 8899 0011' },
    ],
    email: 'info@pulsoproducciones.cl',
    accessKey: 'YP-5R1T-66KD',
  },
  nexo: {
    owner: { name: 'Andrés Lagos', phone: '+56 9 9988 7766' },
    generalProducers: [{ name: 'Sofía Paredes', phone: '+56 9 2233 4455' }],
    email: 'admin@nexoentertainment.cl',
    accessKey: 'YP-9W4X-18QZ',
  },
};

function slugEmailFromName(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
}

function generatedDetail(producer: RegisteredProducer): RegisteredProducerDetail {
  const slug = slugEmailFromName(producer.logoLabel);
  return {
    owner: { name: 'Carlos Martínez', phone: '+56 9 8765 4321' },
    generalProducers: [{ name: 'Alejandra Rojas', phone: '+56 9 3344 1122' }],
    email: `contacto@${slug}.cl`,
    accessKey: `YP-${producer.id.slice(0, 4).toUpperCase()}-41QX`,
  };
}

export function getRegisteredProducerDetail(producer: RegisteredProducer): RegisteredProducerDetail {
  return PRODUCER_DETAILS[producer.id] ?? generatedDetail(producer);
}

export function formatProducerContact(contact: ProducerContact) {
  return `${contact.name} — ${contact.phone}`;
}
