import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminApi,
  AdminDrinkOrderDetail,
  AdminDrinkOrderListItem,
  AdminDrinkOrderQrStatus,
  AdminEvent,
  EventDrinkProduct,
} from '../api/client';
import { EventOrderDetailModal } from '../components/event-orders/EventOrderDetailModal';
import {
  EventOrderQrStatusPill,
  QR_STATUS_KEYS,
} from '../components/event-orders/EventOrderQrStatusPill';
import { EventWorkspaceLayout } from '../components/event-workspace/EventWorkspaceLayout';
import { Alert } from '../components/ui/Alert';
import {
  IconBan,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconRefresh,
  IconSearch,
  IconUndo,
} from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 8;

function defaultDateRange(event: AdminEvent | null) {
  if (!event) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }

  const start = new Date(event.starts_at);
  start.setDate(start.getDate() - 7);
  const end = new Date(event.starts_at);
  end.setDate(end.getDate() + 7);

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function EventOrdersPage() {
  const { eventId = '' } = useParams();
  const { t, dateLocale, numberLocale } = useI18n();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [products, setProducts] = useState<EventDrinkProduct[]>([]);
  const [orders, setOrders] = useState<AdminDrinkOrderListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    total_pages: 1,
    from: 0,
    to: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [qrStatusFilter, setQrStatusFilter] = useState<AdminDrinkOrderQrStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminDrinkOrderDetail | null>(null);

  function formatOrderDateTime(iso: string) {
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

  function formatMoney(clp: number) {
    return `$${new Intl.NumberFormat(numberLocale).format(clp)} CLP`;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, productFilter, paymentFilter, qrStatusFilter, dateFrom, dateTo]);

  async function loadEvent() {
    const result = await adminApi.events();
    if (result.ok) {
      const matched = result.data?.events.find((item) => item.id === eventId) ?? null;
      setEvent(matched);
      if (matched && !dateFrom && !dateTo) {
        const range = defaultDateRange(matched);
        setDateFrom(range.from);
        setDateTo(range.to);
      }
    }
  }

  async function loadProducts() {
    const result = await adminApi.eventDrinkProducts(eventId);
    if (result.ok) {
      setProducts(result.data?.products ?? []);
    }
  }

  async function loadOrders() {
    setLoading(true);
    const result = await adminApi.eventDrinkOrders(eventId, {
      q: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
      product_id: productFilter || undefined,
      qr_status: qrStatusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? t('orders.loadError'));
      return;
    }

    setError('');
    setOrders(result.data?.orders ?? []);
    setPagination(result.data?.pagination ?? pagination);
  }

  useEffect(() => {
    void loadEvent();
    void loadProducts();
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !dateFrom || !dateTo) {
      return;
    }
    void loadOrders();
  }, [eventId, debouncedSearch, page, productFilter, qrStatusFilter, dateFrom, dateTo]);

  const pageNumbers = useMemo(() => {
    const totalPages = pagination.total_pages;
    const current = pagination.page;
    const numbers: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, start + 4);
    for (let value = start; value <= end; value += 1) {
      numbers.push(value);
    }
    return numbers;
  }, [pagination.page, pagination.total_pages]);

  function clearFilters() {
    setSearch('');
    setProductFilter('');
    setPaymentFilter('');
    setQrStatusFilter('');
    if (event) {
      const range = defaultDateRange(event);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }

  async function handleExport() {
    const result = await adminApi.exportEventDrinkOrders(eventId, {
      q: debouncedSearch || undefined,
      product_id: productFilter || undefined,
      qr_status: qrStatusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });

    if (!result.ok || !('blob' in result)) {
      setError(result.error ?? t('orders.exportError'));
      return;
    }

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orders-${eventId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(t('orders.exportDone'));
  }

  async function openOrder(orderId: string) {
    setActionLoading(orderId);
    const result = await adminApi.eventDrinkOrder(eventId, orderId);
    setActionLoading(null);
    if (!result.ok || !result.data) {
      setError(result.error ?? t('orders.loadOrderError'));
      return;
    }
    setSelectedOrder(result.data);
  }

  async function runAction(
    orderId: string,
    action: 'reissue' | 'refund' | 'invalidate',
  ) {
    setActionLoading(`${action}:${orderId}`);
    const result =
      action === 'reissue'
        ? await adminApi.reissueEventDrinkOrderQr(eventId, orderId)
        : action === 'refund'
          ? await adminApi.refundEventDrinkOrder(eventId, orderId)
          : await adminApi.invalidateEventDrinkOrder(eventId, orderId);
    setActionLoading(null);

    if (!result.ok) {
      setError(result.error ?? t('orders.actionError'));
      return;
    }

    setMessage(
      action === 'reissue'
        ? t('orders.reissueSuccess')
        : action === 'refund'
          ? t('orders.refundSuccess')
          : t('orders.invalidateSuccess'),
    );
    await loadOrders();
    if (selectedOrder?.order_id === orderId && result.data) {
      setSelectedOrder(result.data);
    }
  }

  return (
    <EventWorkspaceLayout event={event}>
      <div className="event-orders-page">
        <header className="event-orders-page__header">
          <div>
            <h1>{t('orders.title')}</h1>
            <p>{t('orders.subtitle')}</p>
          </div>
        </header>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <div className="event-orders-toolbar">
          <label className="event-orders-search">
            <IconSearch />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('orders.searchPlaceholder')}
            />
          </label>

          <div className="event-orders-filters">
            <label className="event-orders-filter-field">
              <span>{t('orders.date')}</span>
              <div className="event-orders-date-range">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
                <span>-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>
            </label>

            <label className="event-orders-filter-field">
              <span>{t('orders.product')}</span>
              <select
                className="select-field"
                value={productFilter}
                onChange={(event) => setProductFilter(event.target.value)}
              >
                <option value="">{t('orders.allProducts')}</option>
                {products.map((product) => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="event-orders-filter-field">
              <span>{t('orders.paymentMethod')}</span>
              <select
                className="select-field"
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
              >
                <option value="">{t('orders.allPaymentMethods')}</option>
                <option value="none">{t('orders.noPayment')}</option>
              </select>
            </label>

            <label className="event-orders-filter-field">
              <span>{t('orders.qrStatus')}</span>
              <select
                className="select-field"
                value={qrStatusFilter}
                onChange={(event) =>
                  setQrStatusFilter(event.target.value as AdminDrinkOrderQrStatus | '')
                }
              >
                <option value="">{t('orders.allQrStatuses')}</option>
                {QR_STATUS_KEYS.map((status) => (
                  <option key={status} value={status}>
                    {t(`qrStatus.${status}.label`)}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className="outline-btn outline-btn--sm" onClick={clearFilters}>
              {t('orders.clearFilters')}
            </button>

            <button type="button" className="primary-btn primary-btn--sm" onClick={() => void handleExport()}>
              <IconDownload />
              {t('common.export')}
            </button>
          </div>
        </div>

        <div className="event-orders-legend">
          {QR_STATUS_KEYS.map((status) => (
            <div key={status} className="event-orders-legend__item">
              <EventOrderQrStatusPill status={status} />
              <span>{t(`qrStatus.${status}.description`)}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <LoadingBlock label={t('orders.loading')} />
        ) : (
          <div className="table-card event-orders-table-card">
            <table className="data-table event-orders-table">
              <thead>
                <tr>
                  <th>{t('orders.colOrderId')}</th>
                  <th>{t('orders.colUser')}</th>
                  <th>{t('orders.colProduct')}</th>
                  <th>{t('orders.colPayment')}</th>
                  <th>{t('orders.colTime')}</th>
                  <th>{t('orders.colQrStatus')}</th>
                  <th>{t('orders.colTotal')}</th>
                  <th />
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
                  orders.map((order) => (
                    <tr key={order.order_id}>
                      <td className="cell-strong">{order.display_order_id}</td>
                      <td>
                        <div className="event-orders-user">
                          {order.user.profile_photo_url ? (
                            <img src={order.user.profile_photo_url} alt="" />
                          ) : (
                            <span className="event-orders-user__avatar">{order.user.initials}</span>
                          )}
                          <div>
                            <strong>{order.user.full_name}</strong>
                            <p className="muted">{order.user.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td>{order.product_summary}</td>
                      <td>
                        <div className="event-orders-payment">
                          <span className="event-orders-payment__badge">APP</span>
                          <span>
                            {order.payment_method.type === 'none'
                              ? t('orders.noPayment')
                              : order.payment_method.label}
                          </span>
                        </div>
                      </td>
                      <td>{formatOrderDateTime(order.created_at)}</td>
                      <td>
                        <EventOrderQrStatusPill status={order.qr_status} />
                      </td>
                      <td className="cell-strong">{formatMoney(order.total_clp)}</td>
                      <td>
                        <div className="event-orders-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('orders.viewOrder')}
                            onClick={() => void openOrder(order.order_id)}
                            disabled={actionLoading === order.order_id}
                          >
                            <IconEye />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('orders.reissueQr')}
                            onClick={() => void runAction(order.order_id, 'reissue')}
                            disabled={actionLoading === `reissue:${order.order_id}`}
                          >
                            <IconRefresh />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('orders.refund')}
                            onClick={() => void runAction(order.order_id, 'refund')}
                            disabled={actionLoading === `refund:${order.order_id}`}
                          >
                            <IconUndo />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            title={t('orders.invalidate')}
                            onClick={() => void runAction(order.order_id, 'invalidate')}
                            disabled={actionLoading === `invalidate:${order.order_id}`}
                          >
                            <IconBan />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="event-orders-pagination">
          <p>
            {t('orders.pagination', {
              from: pagination.from,
              to: pagination.to,
              total: pagination.total,
            })}
          </p>
          <div className="event-orders-pagination__controls">
            <button
              type="button"
              className="outline-btn outline-btn--sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <IconChevronLeft />
            </button>
            {pageNumbers.map((number) => (
              <button
                key={number}
                type="button"
                className={
                  number === page
                    ? 'event-orders-pagination__page event-orders-pagination__page--active'
                    : 'event-orders-pagination__page'
                }
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              className="outline-btn outline-btn--sm"
              disabled={page >= pagination.total_pages}
              onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
            >
              <IconChevronRight />
            </button>
          </div>
        </footer>
      </div>

      {selectedOrder ? (
        <EventOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </EventWorkspaceLayout>
  );
}
