import { useI18n } from '../../i18n/useI18n';
import { EventOrderQrStatusPill, QR_STATUS_KEYS } from './EventOrderQrStatusPill';

export function EventOrdersLegend() {
  const { t } = useI18n();

  return (
    <div className="event-orders-legend">
      <span className="event-orders-legend__title">{t('orders.legendTitle')}</span>
      {QR_STATUS_KEYS.map((status) => (
        <div key={status} className="event-orders-legend__item">
          <EventOrderQrStatusPill status={status} />
          <span>{t(`qrStatus.${status}.description`)}</span>
        </div>
      ))}
    </div>
  );
}
