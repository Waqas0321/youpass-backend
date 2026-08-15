export type CompTypeId = 'general' | 'vip' | 'backstage' | 'open_bar' | 'vip_table';

export type CompStatusId =
  | 'available'
  | 'sent'
  | 'accepted'
  | 'redeemed'
  | 'expired'
  | 'invalidated';

export type Comp = {
  id: string;
  code: string;
  beneficiary_name: string;
  phone: string;
  type: CompTypeId;
  benefit: string;
  status: CompStatusId;
  created_at: string;
  used_at?: string | null;
  deep_link?: string;
  issue_date?: string;
  time_from?: string;
  time_to?: string;
};

export const COMP_TYPES: Array<{ id: CompTypeId; color: string }> = [
  { id: 'general', color: '#a855f7' },
  { id: 'vip', color: '#eab308' },
  { id: 'backstage', color: '#3b82f6' },
  { id: 'open_bar', color: '#22c55e' },
  { id: 'vip_table', color: '#ec4899' },
];

export const COMP_STATUSES: CompStatusId[] = [
  'available',
  'sent',
  'accepted',
  'redeemed',
  'expired',
  'invalidated',
];

export function guestInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatCompDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatCompDateTime(iso: string, locale: string) {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale !== 'es-CL',
  }).format(date);
  return `${datePart} · ${timePart}`;
}

export function filterComps(comps: Comp[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return comps;
  }

  return comps.filter((comp) =>
    [comp.code, comp.beneficiary_name, comp.phone, comp.benefit]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
}

export function visiblePages(current: number, total: number) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current > 1) {
    pages.add(current - 1);
  }
  if (current < total) {
    pages.add(current + 1);
  }

  return [...pages].sort((left, right) => left - right);
}
