import type { AdminDrinkOrderQrStatus, EventDrinkProduct } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import {
  IconCalendar,
  IconDownload,
  IconRefresh,
  IconSearch,
  IconSliders,
} from '../ui/Icons';
import { QR_STATUS_KEYS } from './EventOrderQrStatusPill';
import { formatShortDate } from './eventOrdersUtils';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  productFilter: string;
  onProductFilterChange: (value: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  qrStatusFilter: AdminDrinkOrderQrStatus | '';
  onQrStatusFilterChange: (value: AdminDrinkOrderQrStatus | '') => void;
  products: EventDrinkProduct[];
  onClearFilters: () => void;
  onExport: () => void;
};

export function EventOrdersToolbar({
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  productFilter,
  onProductFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  qrStatusFilter,
  onQrStatusFilterChange,
  products,
  onClearFilters,
  onExport,
}: Props) {
  const { t, dateLocale } = useI18n();

  const dateRangeLabel =
    dateFrom && dateTo
      ? `${formatShortDate(dateFrom, dateLocale)} - ${formatShortDate(dateTo, dateLocale)}`
      : dateFrom
        ? `${t('orders.dateFrom')}: ${formatShortDate(dateFrom, dateLocale)}`
        : dateTo
          ? `${t('orders.dateTo')}: ${formatShortDate(dateTo, dateLocale)}`
          : t('orders.dateRangePlaceholder');

  return (
    <div className="event-orders-toolbar">
      <label className="event-orders-search">
        <IconSearch />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('orders.searchPlaceholder')}
        />
      </label>

      <div className="event-orders-toolbar__row">
        <div className="event-orders-toolbar__filters">
          <label className="event-orders-date-pill">
            <IconCalendar />
            <span>{dateRangeLabel}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              aria-label={t('orders.dateFrom')}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              aria-label={t('orders.dateTo')}
            />
          </label>

          <select
            className="event-orders-select"
            value={productFilter}
            onChange={(event) => onProductFilterChange(event.target.value)}
            aria-label={t('orders.product')}
          >
            <option value="">{t('orders.allProducts')}</option>
            {products.map((product) => (
              <option key={product.product_id} value={product.product_id}>
                {product.name}
              </option>
            ))}
          </select>

          <select
            className="event-orders-select"
            value={paymentFilter}
            onChange={(event) => onPaymentFilterChange(event.target.value)}
            aria-label={t('orders.paymentMethod')}
            disabled
            title={t('orders.paymentFilterSoon')}
          >
            <option value="">{t('orders.allPaymentMethods')}</option>
            <option value="webpay">Webpay</option>
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="apple_pay">Apple Pay</option>
            <option value="none">{t('orders.noPayment')}</option>
          </select>

          <select
            className="event-orders-select"
            value={qrStatusFilter}
            onChange={(event) =>
              onQrStatusFilterChange(event.target.value as AdminDrinkOrderQrStatus | '')
            }
            aria-label={t('orders.qrStatus')}
          >
            <option value="">{t('orders.allQrStatuses')}</option>
            {QR_STATUS_KEYS.map((status) => (
              <option key={status} value={status}>
                {t(`qrStatus.${status}.label`)}
              </option>
            ))}
          </select>

          <button type="button" className="event-orders-more-filters" disabled title={t('orders.moreFiltersSoon')}>
            <IconSliders />
            {t('orders.moreFilters')}
          </button>

          <button type="button" className="event-orders-clear-filters" onClick={onClearFilters}>
            <IconRefresh />
            {t('orders.clearFilters')}
          </button>
        </div>

        <button type="button" className="event-orders-export" onClick={onExport}>
          <IconDownload />
          {t('common.export')}
        </button>
      </div>
    </div>
  );
}
