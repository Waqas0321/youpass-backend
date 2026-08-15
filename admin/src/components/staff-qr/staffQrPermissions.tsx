import {
  IconBriefcase,
  IconChart,
  IconQrCode,
  IconSettings,
  IconShoppingBag,
  IconTicket,
} from '../ui/Icons';
import type { useI18n } from '../../i18n/useI18n';

export const STAFF_PERMISSION_CATALOG = [
  { id: 'scan_products', color: '#3ecf8e' },
  { id: 'scan_tickets', color: '#5b9cf6' },
  { id: 'bar_supervisor', color: '#ffb800' },
  { id: 'tickets_supervisor', color: '#2dd4bf' },
  { id: 'view_statistics', color: '#9c5fd4' },
  { id: 'general_admin', color: '#cbd5e1' },
] as const;

export type StaffPermissionId = (typeof STAFF_PERMISSION_CATALOG)[number]['id'];

export function permissionLabel(permissionId: string, t: ReturnType<typeof useI18n>['t']) {
  return t(`staffQr.permissionLabels.${permissionId}` as 'staffQr.permissionLabels.scan_products');
}

export function permissionColor(permissionId: string) {
  return (
    STAFF_PERMISSION_CATALOG.find((permission) => permission.id === permissionId)?.color ??
    '#94a3b8'
  );
}

export function PermissionIcon({ permissionId }: { permissionId: string }) {
  switch (permissionId) {
    case 'scan_products':
      return <IconQrCode />;
    case 'scan_tickets':
      return <IconTicket />;
    case 'view_statistics':
      return <IconChart />;
    case 'tickets_supervisor':
      return <IconBriefcase />;
    case 'bar_supervisor':
      return <IconShoppingBag />;
    case 'general_admin':
      return <IconSettings />;
    default:
      return <IconQrCode />;
  }
}
