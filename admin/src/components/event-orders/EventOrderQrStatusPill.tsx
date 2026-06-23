import type { AdminDrinkOrderQrStatus } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';

const STATUS_CLASS: Record<AdminDrinkOrderQrStatus, string> = {
  paid: 'qr-status-pill qr-status-pill--paid',
  pending: 'qr-status-pill qr-status-pill--pending',
  redeemed: 'qr-status-pill qr-status-pill--redeemed',
  refunded: 'qr-status-pill qr-status-pill--refunded',
  invalid: 'qr-status-pill qr-status-pill--invalid',
};

type Props = {
  status: AdminDrinkOrderQrStatus;
};

export function EventOrderQrStatusPill({ status }: Props) {
  const { t } = useI18n();
  return (
    <span className={STATUS_CLASS[status]}>{t(`qrStatus.${status}.label`)}</span>
  );
}

export const QR_STATUS_KEYS: AdminDrinkOrderQrStatus[] = [
  'paid',
  'pending',
  'redeemed',
  'refunded',
  'invalid',
];
