export type YoupassTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type FrequentClient = {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  attendanceCount: number;
  avgTicketClp: number;
  tier: YoupassTier;
};

export const YOUPASS_TIERS: YoupassTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

const BASE_CLIENTS: Array<Omit<FrequentClient, 'id'>> = [
  { name: 'Camila Méndez', phone: '+56 9 8765 4321', attendanceCount: 12, avgTicketClp: 85_000, tier: 'diamond' },
  { name: 'Rodrigo Valdés', phone: '+56 9 7654 3210', attendanceCount: 10, avgTicketClp: 73_500, tier: 'platinum' },
  { name: 'Valentina Soto', phone: '+56 9 6543 2109', attendanceCount: 11, avgTicketClp: 68_000, tier: 'gold' },
  { name: 'Matías Rojas', phone: '+56 9 5432 1098', attendanceCount: 7, avgTicketClp: 55_000, tier: 'silver' },
  { name: 'Isabella Torres', phone: '+56 9 4321 0987', attendanceCount: 5, avgTicketClp: 42_000, tier: 'bronze' },
  { name: 'Diego Fernández', phone: '+56 9 3210 9876', attendanceCount: 10, avgTicketClp: 78_000, tier: 'platinum' },
  { name: 'Sofía Herrera', phone: '+56 9 2109 8765', attendanceCount: 8, avgTicketClp: 61_000, tier: 'gold' },
  { name: 'Tomás Muñoz', phone: '+56 9 1098 7654', attendanceCount: 6, avgTicketClp: 48_000, tier: 'silver' },
  { name: 'Javiera López', phone: '+56 9 9988 7766', attendanceCount: 14, avgTicketClp: 92_000, tier: 'diamond' },
  { name: 'Benjamín Castro', phone: '+56 9 8877 6655', attendanceCount: 4, avgTicketClp: 38_000, tier: 'bronze' },
  { name: 'Francisca Silva', phone: '+56 9 7766 5544', attendanceCount: 9, avgTicketClp: 71_000, tier: 'gold' },
  { name: 'Sebastián Paredes', phone: '+56 9 6655 4433', attendanceCount: 13, avgTicketClp: 88_000, tier: 'platinum' },
  { name: 'Antonia Vega', phone: '+56 9 5544 3322', attendanceCount: 3, avgTicketClp: 35_000, tier: 'bronze' },
  { name: 'Felipe Morales', phone: '+56 9 4433 2211', attendanceCount: 8, avgTicketClp: 58_000, tier: 'silver' },
  { name: 'Catalina Fuentes', phone: '+56 9 3322 1100', attendanceCount: 11, avgTicketClp: 74_000, tier: 'gold' },
  { name: 'Nicolás Bravo', phone: '+56 9 2211 0099', attendanceCount: 15, avgTicketClp: 95_000, tier: 'diamond' },
  { name: 'Emilia Contreras', phone: '+56 9 1100 9988', attendanceCount: 6, avgTicketClp: 46_000, tier: 'silver' },
  { name: 'Agustín Navarro', phone: '+56 9 9090 8080', attendanceCount: 10, avgTicketClp: 69_000, tier: 'gold' },
  { name: 'Martina Espinoza', phone: '+56 9 8080 7070', attendanceCount: 7, avgTicketClp: 52_000, tier: 'bronze' },
];

export function buildDemoFrequentClients(total = 152): FrequentClient[] {
  const clients: FrequentClient[] = [];

  for (let index = 0; index < total; index += 1) {
    const base = BASE_CLIENTS[index % BASE_CLIENTS.length];
    clients.push({
      ...base,
      id: `demo-frequent-${index + 1}`,
      phone: index < BASE_CLIENTS.length ? base.phone : `+56 9 ${String(8000 + index).slice(-4)} ${String(1000 + index).slice(-4)}`,
      attendanceCount: index < BASE_CLIENTS.length ? base.attendanceCount : base.attendanceCount + (index % 4),
      avgTicketClp: index < BASE_CLIENTS.length ? base.avgTicketClp : base.avgTicketClp + (index % 5) * 1_500,
    });
  }

  return clients;
}

export function sortFrequentClients(clients: FrequentClient[]): FrequentClient[] {
  const priorityPhones = BASE_CLIENTS.map((client) => client.phone);

  return [...clients].sort((left, right) => {
    const leftIndex = priorityPhones.indexOf(left.phone);
    const rightIndex = priorityPhones.indexOf(right.phone);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      return leftIndex - rightIndex;
    }

    return left.name.localeCompare(right.name, 'es');
  });
}

export function mergeFrequentClients(
  apiClients: FrequentClient[],
  demoClients: FrequentClient[],
): FrequentClient[] {
  const merged = new Map<string, FrequentClient>();

  for (const client of apiClients) {
    merged.set(client.phone, client);
  }

  for (const client of demoClients) {
    merged.set(client.phone, client);
  }

  return sortFrequentClients([...merged.values()]);
}

export function formatFrequentClientClp(value: number, locale = 'en-US') {
  return `CLP ${new Intl.NumberFormat(locale).format(value)}`;
}

export function guestInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function visiblePages(current: number, total: number) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current > 1) pages.add(current - 1);
  if (current < total) pages.add(current + 1);
  return [...pages].sort((left, right) => left - right);
}
