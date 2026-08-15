import { IconBriefcase, IconCrown, IconStar, IconTicket } from '../ui/Icons';

export type CourtesyEntryType = 'general' | 'vip' | 'vip_table' | 'backstage';

export const COURTESY_ENTRY_TYPES: CourtesyEntryType[] = [
  'general',
  'vip',
  'vip_table',
  'backstage',
];

export function courtesyEntryIcon(type: CourtesyEntryType) {
  switch (type) {
    case 'general':
      return IconTicket;
    case 'vip':
      return IconStar;
    case 'vip_table':
      return IconCrown;
    case 'backstage':
      return IconBriefcase;
    default:
      return IconTicket;
  }
}

export function courtesyEntrySlotLabel(type: CourtesyEntryType) {
  switch (type) {
    case 'general':
      return 'General';
    case 'vip':
      return 'VIP invitados';
    case 'vip_table':
      return 'Mesa VIP';
    case 'backstage':
      return 'Backstage';
    default:
      return 'General';
  }
}
