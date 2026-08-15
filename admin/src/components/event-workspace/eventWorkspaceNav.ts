import type { ComponentType } from 'react';
import {
  IconChart,
  IconCreditCard,
  IconDashboard,
  IconDrink,
  IconEdit,
  IconLayoutGrid,
  IconMail,
  IconMapPin,
  IconQrCode,
  IconShoppingBag,
  IconSpark,
  IconTicket,
} from '../ui/Icons';

export type EventWorkspaceNavKey =
  | 'summary'
  | 'info'
  | 'tickets'
  | 'floorPlan'
  | 'vipTables'
  | 'drinks'
  | 'orders'
  | 'staffQr'
  | 'analytics'
  | 'invitations'
  | 'comps'
  | 'payments';

type EventWorkspaceNavItem = {
  key: EventWorkspaceNavKey;
  route: string;
  enabled: boolean;
  Icon: ComponentType<{ className?: string }>;
};

/** Event workspace sidebar — order matches the producer console design. */
export const EVENT_WORKSPACE_NAV: EventWorkspaceNavItem[] = [
  { key: 'summary', route: 'summary', enabled: true, Icon: IconDashboard },
  { key: 'info', route: 'info', enabled: true, Icon: IconEdit },
  { key: 'tickets', route: 'tickets', enabled: true, Icon: IconTicket },
  { key: 'floorPlan', route: 'floor-plan', enabled: true, Icon: IconMapPin },
  { key: 'vipTables', route: 'vip-tables', enabled: true, Icon: IconLayoutGrid },
  { key: 'drinks', route: 'drinks', enabled: true, Icon: IconDrink },
  { key: 'orders', route: 'orders', enabled: true, Icon: IconShoppingBag },
  { key: 'staffQr', route: 'staff-qr', enabled: true, Icon: IconQrCode },
  { key: 'analytics', route: 'analytics', enabled: true, Icon: IconChart },
  { key: 'invitations', route: 'invitations', enabled: true, Icon: IconMail },
  { key: 'comps', route: 'comps', enabled: true, Icon: IconSpark },
  { key: 'payments', route: 'payments', enabled: true, Icon: IconCreditCard },
];
