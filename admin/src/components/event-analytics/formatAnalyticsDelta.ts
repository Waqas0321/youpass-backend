export function formatAnalyticsDelta(deltaPct: number, locale: string) {
  const sign = deltaPct >= 0 ? '+ ' : '- ';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(deltaPct));

  return `${sign}${formatted}%`;
}

export function formatAnalyticsCurrency(value: number, locale: string, currency = 'CLP') {
  const decimals = currency === 'USD' ? 2 : 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(currency === 'USD' ? value / 100 : value);
}

/** Zone / payment center totals with explicit currency symbol. */
export function formatZoneRevenue(value: number, locale: string, currency = 'CLP') {
  if (currency === 'USD') {
    return formatAnalyticsCurrency(value, locale, currency);
  }

  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  return `$${amount}`;
}

export function formatAnalyticsPercent(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}
