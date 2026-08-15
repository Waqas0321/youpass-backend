import {
  IconDrink,
  IconQrCode,
  IconTicket,
  IconUserPlus,
  IconUsers,
} from '../ui/Icons';
import type { DashboardActivityItem } from './dashboardData';

type DashboardActivityIconProps = {
  type: DashboardActivityItem['icon'];
};

export function DashboardActivityIcon({ type }: DashboardActivityIconProps) {
  const className = 'dash-activity__icon-svg';
  switch (type) {
    case 'ticket':
      return <IconTicket className={className} />;
    case 'drink':
      return <IconDrink className={className} />;
    case 'table':
      return <IconUsers className={className} />;
    case 'qr':
      return <IconQrCode className={className} />;
    case 'user':
      return <IconUserPlus className={className} />;
    default:
      return <IconTicket className={className} />;
  }
}
