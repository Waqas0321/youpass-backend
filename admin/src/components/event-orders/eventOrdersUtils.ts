import type { AdminDrinkOrderListItem } from '../../api/client';
import { formatDrinkPrice } from '../../utils/drinkPrice';

export function formatOrderDate(iso: string, dateLocale: string) {
  const formatted = new Intl.DateTimeFormat(dateLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));

  if (!dateLocale.startsWith('es')) {
    return formatted;
  }

  return formatted.replace(
    /(\d{1,2})\s+([^\s]+)/,
    (_, day: string, month: string) => `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`,
  );
}

export function formatOrderTime(iso: string, dateLocale: string) {
  const formatted = new Intl.DateTimeFormat(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

  return dateLocale.startsWith('es') ? `${formatted} hrs` : formatted;
}

export function formatShortDate(iso: string, dateLocale: string) {
  return new Intl.DateTimeFormat(dateLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatMoneyAmount(amountMinor: number, currency: string, numberLocale: string) {
  return formatDrinkPrice(amountMinor, currency, numberLocale);
}

export function getOrderProductPrimary(order: AdminDrinkOrderListItem) {
  const firstLine = order.line_items[0];
  if (firstLine) {
    return firstLine.quantity > 1
      ? `${firstLine.product_name} x${firstLine.quantity}`
      : firstLine.product_name;
  }

  return order.product_summary;
}
