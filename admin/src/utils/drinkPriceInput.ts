export function drinkPriceInputStep(currency: string) {
  return currency === 'CLP' ? 1 : 0.01;
}

export function drinkPriceInputDecimals(currency: string) {
  return currency === 'CLP' ? 0 : 2;
}

export function formatDrinkPriceFormValue(amount: number, currency: string) {
  if (currency === 'CLP') {
    return String(Math.round(amount));
  }
  return (amount / 100).toFixed(2);
}

export function parseDrinkPriceFormValue(raw: string, currency: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }

  if (currency === 'CLP') {
    return Math.max(0, Math.round(Number(trimmed)));
  }

  const dollars = Number(trimmed);
  if (!Number.isFinite(dollars)) {
    return 0;
  }
  return Math.max(0, Math.round(dollars * 100));
}

export function drinkPricePlaceholder(currency: string) {
  return currency === 'CLP' ? '6000' : '6.00';
}
