export function formatMessage(template: string, params: Record<string, string | number>) {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function formatPercentValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrencyClp(value: number, locale: string) {
  const digits = new Intl.NumberFormat(locale.startsWith('es') ? 'es-CL' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);

  return `$${digits}`;
}
