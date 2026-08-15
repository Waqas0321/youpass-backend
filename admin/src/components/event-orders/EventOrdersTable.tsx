import type { AdminDrinkOrderListItem, AdminDrinkOrderQrStatus } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { IconBan, IconEye, IconRefresh, IconSort, IconUndo } from '../ui/Icons';
import { EventOrderActionButton } from './EventOrderActionButton';
import { EventOrderQrStatusPill } from './EventOrderQrStatusPill';
import {
  formatMoneyAmount,
  formatOrderDate,
  formatOrderTime,
  getOrderProductPrimary,
} from './eventOrdersUtils';

type Props = {
  orders: AdminDrinkOrderListItem[];
  actionLoading: string | null;
  onView: (orderId: string) => void;
  onReissue: (orderId: string) => void;
  onRefund: (orderId: string) => void;
  onInvalidate: (orderId: string) => void;
};

function PaymentBadge({ brand, label }: { brand: string; label: string }) {
  const normalized = brand.toLowerCase();
  const normalizedLabel = label.toLowerCase();

  if (normalized.includes('webpay') || normalizedLabel.includes('webpay')) {
    return (
      <span className="event-orders-payment__brand event-orders-payment__brand--webpay-logo">
        webpay
      </span>
    );
  }
  if (normalized.includes('visa') || normalizedLabel.includes('visa')) {
    return <span className="event-orders-payment__brand event-orders-payment__brand--visa">VISA</span>;
  }
  if (normalized.includes('master') || normalizedLabel.includes('mastercard')) {
    return (
      <span className="event-orders-payment__brand event-orders-payment__brand--mastercard">MC</span>
    );
  }

  return <span className="event-orders-payment__brand">APP</span>;
}

function canReissue(status: AdminDrinkOrderQrStatus) {
  return status === 'paid' || status === 'pending';
}

function canRefund(status: AdminDrinkOrderQrStatus) {
  return status === 'paid' || status === 'pending' || status === 'redeemed';
}

function canInvalidate(status: AdminDrinkOrderQrStatus) {
  return status !== 'invalid' && status !== 'refunded';
}

export function EventOrdersTable({
  orders,
  actionLoading,
  onView,
  onReissue,
  onRefund,
  onInvalidate,
}: Props) {
  const { t, dateLocale, numberLocale } = useI18n();

  return (
    <div className="event-orders-table-card">
      <table className="event-orders-table">
        <thead>
          <tr>
            <th>
              <span className="event-orders-table__sortable">
                {t('orders.colOrderId')}
                <IconSort />
              </span>
            </th>
            <th>{t('orders.colUser')}</th>
            <th>{t('orders.colProduct')}</th>
            <th>{t('orders.colPayment')}</th>
            <th>{t('orders.colTime')}</th>
            <th>{t('orders.colQrStatus')}</th>
            <th>{t('orders.colTotal')}</th>
            <th aria-label={t('orders.colActions')} />
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8} className="event-orders-table__empty">
                {t('orders.empty')}
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const paymentLabel =
                order.payment_method.type === 'none'
                  ? t('orders.noPayment')
                  : order.payment_method.last_four
                    ? `${order.payment_method.label} •••• ${order.payment_method.last_four}`
                    : order.payment_method.label;

              return (
                <tr key={order.order_id}>
                  <td>
                    <span className="event-orders-order-id">{order.display_order_id}</span>
                  </td>
                  <td>
                    <div className="event-orders-user">
                      {order.user.profile_photo_url ? (
                        <img src={order.user.profile_photo_url} alt="" />
                      ) : (
                        <span className="event-orders-user__avatar">{order.user.initials}</span>
                      )}
                      <div>
                        <strong>{order.user.full_name}</strong>
                        <p>{order.user.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="event-orders-product">
                      <strong>{getOrderProductPrimary(order)}</strong>
                      <span>{t('orders.productContextDrinks')}</span>
                    </div>
                  </td>
                  <td>
                    <div className="event-orders-payment">
                      <PaymentBadge brand={order.payment_method.brand} label={paymentLabel} />
                      <span className="event-orders-payment__label">{paymentLabel}</span>
                    </div>
                  </td>
                  <td>
                    <div className="event-orders-time">
                      <span className="event-orders-time__date">
                        {formatOrderDate(order.created_at, dateLocale)}
                      </span>
                      <span className="event-orders-time__hour">
                        {formatOrderTime(order.created_at, dateLocale)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <EventOrderQrStatusPill status={order.qr_status} variant="table" />
                  </td>
                  <td>
                    <div className="event-orders-total">
                      <span className="event-orders-total__amount">
                        {formatMoneyAmount(order.total_clp, order.currency ?? 'CLP', numberLocale)}
                      </span>
                      <span className="event-orders-total__currency">{order.currency}</span>
                    </div>
                  </td>
                  <td>
                    <div className="event-orders-actions">
                      <EventOrderActionButton
                        label={t('orders.viewOrder')}
                        icon={<IconEye />}
                        disabled={actionLoading === order.order_id}
                        onClick={() => onView(order.order_id)}
                      />
                      <EventOrderActionButton
                        label={t('orders.reissueQr')}
                        icon={<IconRefresh />}
                        disabled={
                          !canReissue(order.qr_status) || actionLoading === `reissue:${order.order_id}`
                        }
                        onClick={() => onReissue(order.order_id)}
                      />
                      <EventOrderActionButton
                        label={t('orders.refund')}
                        icon={<IconUndo />}
                        disabled={
                          !canRefund(order.qr_status) || actionLoading === `refund:${order.order_id}`
                        }
                        onClick={() => onRefund(order.order_id)}
                      />
                      <EventOrderActionButton
                        label={t('orders.invalidate')}
                        icon={<IconBan />}
                        danger
                        disabled={
                          !canInvalidate(order.qr_status) ||
                          actionLoading === `invalidate:${order.order_id}`
                        }
                        onClick={() => onInvalidate(order.order_id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
