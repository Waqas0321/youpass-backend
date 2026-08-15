import type { AdminVipTableGuest, AdminVipTableRow } from '../../api/client';

export type VipTableStatus = 'available' | 'reserved' | 'paid' | 'blocked';

export type EventVipTableRow = {
  id: string;
  zoneId: string;
  zoneExternalId: string;
  number: number;
  zoneLabel: string;
  zoneColor: string;
  capacity: number;
  status: VipTableStatus;
  price: number;
  currency: string;
  buyer?: {
    name: string;
    phone: string;
    avatarInitials: string;
    avatarUrl?: string;
  };
};

export type GuestEntryStatus = 'confirmed' | 'sent' | 'rejected' | 'pending';

export type VipTableGuest = {
  id: string;
  name: string;
  phone: string;
  entryStatus: GuestEntryStatus;
  slotStatus: string;
  cancellable: boolean;
};

export type VipZoneOption = {
  zoneId: string;
  externalId: string;
  label: string;
};

export const VIP_TABLES_PAGE_SIZE = 10;

const ZONE_COLORS: Record<string, string> = {
  'VIP DJ': '#a855f7',
  'VIP 1': '#f97316',
  'VIP 2': '#f472b6',
  'VIP 3': '#ffb800',
};

export function formatDisplayPhone(phone: string): string {
  if (!phone || phone === '—') {
    return '—';
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('56') && digits.length >= 11) {
    return `+56 ${digits.slice(2, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  }

  if (digits.startsWith('569') && digits.length >= 11) {
    return `+56 ${digits.slice(2, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  }

  if (phone.startsWith('+')) {
    return phone;
  }

  return phone;
}

export function formatVipTablePrice(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function mapAdminVipTableRow(row: AdminVipTableRow, fallbackCurrency: string): EventVipTableRow {
  return {
    id: row.table_id,
    zoneId: row.zone_id,
    zoneExternalId: row.zone_external_id,
    number: row.number,
    zoneLabel: row.zone_name,
    zoneColor: row.zone_color || ZONE_COLORS[row.zone_name] || '#f2b705',
    capacity: row.capacity,
    status: row.status,
    price: row.price,
    currency: row.currency || fallbackCurrency,
    buyer: row.buyer
      ? {
          name: row.buyer.name,
          phone: row.buyer.phone,
          avatarInitials: row.buyer.avatar_initials,
          avatarUrl: row.buyer.avatar_url ?? undefined,
        }
      : undefined,
  };
}

export function mapAdminVipTableGuest(guest: AdminVipTableGuest): VipTableGuest {
  return {
    id: guest.slot_id,
    name: guest.name,
    phone: guest.phone,
    entryStatus: guest.entry_status,
    slotStatus: guest.slot_status,
    cancellable:
      guest.slot_status !== 'owner' &&
      guest.slot_status !== 'empty' &&
      !guest.slot_id.startsWith('empty-'),
  };
}

export function extractVipZones(tables: EventVipTableRow[]): VipZoneOption[] {
  const seen = new Map<string, VipZoneOption>();

  for (const table of tables) {
    if (!seen.has(table.zoneId)) {
      seen.set(table.zoneId, {
        zoneId: table.zoneId,
        externalId: table.zoneExternalId,
        label: table.zoneLabel,
      });
    }
  }

  return [...seen.values()];
}
