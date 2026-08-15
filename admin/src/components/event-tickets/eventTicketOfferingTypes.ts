import type { AdminTicketOfferingInput } from '../../api/client';

export type TicketOfferingType = AdminTicketOfferingInput['type'];

/** Ticket types exposed in the mobile app (matches backend `TicketOfferingType` enum). */
export const TICKET_OFFERING_TYPE_OPTIONS: {
  value: TicketOfferingType;
  labelKey: string;
  section: 'general' | 'vip';
}[] = [
  { value: 'early_bird', labelKey: 'dashboard.categories.early_bird', section: 'general' },
  { value: 'preventa_2', labelKey: 'dashboard.categories.preventa_2', section: 'general' },
  { value: 'preventa_3', labelKey: 'dashboard.categories.preventa_3', section: 'general' },
  { value: 'general', labelKey: 'dashboard.categories.general', section: 'general' },
  { value: 'vip_general', labelKey: 'dashboard.categories.vip_general', section: 'vip' },
];

export const GENERAL_TICKET_OFFERING_TYPES = TICKET_OFFERING_TYPE_OPTIONS.filter(
  (option) => option.section === 'general',
);

export const VIP_TICKET_OFFERING_TYPES = TICKET_OFFERING_TYPE_OPTIONS.filter(
  (option) => option.section === 'vip',
);
