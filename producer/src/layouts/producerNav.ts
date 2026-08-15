import type { ComponentType } from 'react';
import {
  IconCalendar,
  IconCalendarCheck,
  IconHome,
  IconReport,
  IconUsers,
} from '../components/ui/Icons';

export type ProducerNavItem = {
  id: string;
  to: string;
  labelKey: 'dashboard' | 'events' | 'calendar' | 'users' | 'reports';
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
};

export const producerNavItems: ProducerNavItem[] = [
  { id: 'dashboard', to: '/', labelKey: 'dashboard', icon: IconHome, end: true },
  { id: 'events', to: '/events', labelKey: 'events', icon: IconCalendarCheck },
  { id: 'calendar', to: '/calendar', labelKey: 'calendar', icon: IconCalendar },
  { id: 'users', to: '/users', labelKey: 'users', icon: IconUsers },
  { id: 'reports', to: '/reports', labelKey: 'reports', icon: IconReport },
];
