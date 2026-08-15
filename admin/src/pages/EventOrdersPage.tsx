import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminApi,
  AdminDrinkOrderDetail,
  AdminDrinkOrderListItem,
  AdminDrinkOrderQrStatus,
  EventDrinkProduct,
} from '../api/client';
import { EventOrderDetailModal } from '../components/event-orders/EventOrderDetailModal';
import {
  EventOrdersExportModal,
  type OrdersExportType,
} from '../components/event-orders/EventOrdersExportModal';
import { EventOrdersLegend } from '../components/event-orders/EventOrdersLegend';
import { EventOrdersTable } from '../components/event-orders/EventOrdersTable';
import { EventOrdersToolbar } from '../components/event-orders/EventOrdersToolbar';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { IconChevronLeft, IconChevronRight } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 8;

export function EventOrdersPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, productFilter, paymentFilter, qrStatusFilter, dateFrom, dateTo]);

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
    void loadProducts();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
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
    setDateFrom('');
    setDateTo('');
  }

  async function exportDrinkOrders(filename: string) {
    const result = await adminApi.exportEventDrinkOrders(eventId, {
      q: debouncedSearch || undefined,
      product_id: productFilter || undefined,
      qr_status: qrStatusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });

    if (!result.ok || !('blob' in result)) {
      setError(result.error ?? t('orders.exportError'));
      return false;
    }

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }

  async function handleExportSelect(type: OrdersExportType) {
    setExportModalOpen(false);
    setExporting(true);
    setError('');

    if (type === 'tickets' || type === 'vip') {
      setExporting(false);
      setError(t('orders.exportComingSoon'));
      return;
    }

    const filename =
      type === 'all' ? `all-transactions-${eventId}.csv` : `bar-products-${eventId}.csv`;
    const ok = await exportDrinkOrders(filename);
    setExporting(false);

    if (!ok) {
      return;
    }

    setMessage(type === 'all' ? t('orders.exportAllDone') : t('orders.exportDone'));
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

  async function runAction(orderId: string, action: 'reissue' | 'refund' | 'invalidate') {
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
    <>
      <EventWorkspacePage
        pageTitle={t('orders.title')}
        pageSubtitle={t('orders.subtitle')}
        loadingLabel={t('orders.loading')}
        notFoundLabel={t('orders.notFound')}
      >
        <div className="event-orders-page">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}

          <EventOrdersToolbar
            search={search}
            onSearchChange={setSearch}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            productFilter={productFilter}
            onProductFilterChange={setProductFilter}
            paymentFilter={paymentFilter}
            onPaymentFilterChange={setPaymentFilter}
            qrStatusFilter={qrStatusFilter}
            onQrStatusFilterChange={setQrStatusFilter}
            products={products}
            onClearFilters={clearFilters}
            onExport={() => setExportModalOpen(true)}
          />

          <EventOrdersLegend />

          <div className="event-orders-body">
            {loading ? (
              <LoadingBlock label={t('orders.loading')} />
            ) : (
              <EventOrdersTable
                orders={orders}
                actionLoading={actionLoading}
                onView={(orderId) => void openOrder(orderId)}
                onReissue={(orderId) => void runAction(orderId, 'reissue')}
                onRefund={(orderId) => void runAction(orderId, 'refund')}
                onInvalidate={(orderId) => void runAction(orderId, 'invalidate')}
              />
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
        </div>
      </EventWorkspacePage>

      {selectedOrder ? (
        <EventOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}

      <EventOrdersExportModal
        open={exportModalOpen}
        exporting={exporting}
        onClose={() => setExportModalOpen(false)}
        onSelect={(type) => void handleExportSelect(type)}
      />
    </>
  );
}
