import { AdminDrinkOrderDetail } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { EventOrderQrStatusPill } from './EventOrderQrStatusPill';

type Props = {
  order: AdminDrinkOrderDetail;
  onClose: () => void;
};

export function EventOrderDetailModal({ order, onClose }: Props) {
  const { t, dateLocale, numberLocale } = useI18n();

  function formatMoney(clp: number) {
    return `$${new Intl.NumberFormat(numberLocale).format(clp)} CLP`;
  }

  function formatDateTime(iso: string) {
    return new Intl.DateTimeFormat(dateLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: dateLocale !== 'es-CL',
    })
      .format(new Date(iso))
      .replace(',', ',');
  }

  const paymentLabel =
    order.payment_method.type === 'none' ? t('orders.noPayment') : order.payment_method.label;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card event-order-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="event-order-detail-modal__header">
          <div>
            <p className="event-order-detail-modal__eyebrow">{t('orders.detailEyebrow')}</p>
            <h2>{order.display_order_id}</h2>
          </div>
          <button type="button" className="ghost-btn ghost-btn--sm" onClick={onClose}>
            {t('common.close')}
          </button>
        </header>

        <div className="event-order-detail-modal__grid">
          <div>
            <span className="event-order-detail-modal__label">{t('orders.detailUser')}</span>
            <strong>{order.user.full_name}</strong>
            <p className="muted">{order.user.phone}</p>
          </div>
          <div>
            <span className="event-order-detail-modal__label">{t('orders.qrStatus')}</span>
            <EventOrderQrStatusPill status={order.qr_status} />
          </div>
          <div>
            <span className="event-order-detail-modal__label">{t('orders.detailDate')}</span>
            <strong>{formatDateTime(order.created_at)}</strong>
          </div>
          <div>
            <span className="event-order-detail-modal__label">{t('orders.paymentMethod')}</span>
            <strong>{paymentLabel}</strong>
          </div>
        </div>

        <div className="event-order-detail-modal__section">
          <span className="event-order-detail-modal__label">{t('orders.detailProducts')}</span>
          <ul className="event-order-detail-modal__lines">
            {order.line_items.map((line) => (
              <li key={line.line_id}>
                <div className="event-order-detail-modal__line-main">
                  <span>
                    {line.product_name} x{line.quantity}
                  </span>
                  <strong>{formatMoney(line.line_total_clp)}</strong>
                </div>
                {line.entry_code ? (
                  <div className="event-order-detail-modal__line-qr">
                    <span className="event-order-detail-modal__label">{t('orders.manualCode')}</span>
                    <strong>{line.entry_code}</strong>
                    {line.qr_payload ? (
                      <>
                        <span className="event-order-detail-modal__label">{t('orders.qrPayload')}</span>
                        <code>{line.qr_payload}</code>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="event-order-detail-modal__totals">
          <div>
            <span>{t('orders.subtotal')}</span>
            <strong>{formatMoney(order.subtotal_clp)}</strong>
          </div>
          <div>
            <span>{t('orders.serviceFee')}</span>
            <strong>{formatMoney(order.service_fee_clp)}</strong>
          </div>
          <div className="event-order-detail-modal__total-row">
            <span>{t('orders.total')}</span>
            <strong>{formatMoney(order.total_clp)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
