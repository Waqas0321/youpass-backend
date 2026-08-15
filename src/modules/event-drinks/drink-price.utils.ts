export function drinkPriceDecimals(currency: string) {
  return currency === 'CLP' ? 0 : 2;
}

export function drinkPriceToDisplay(amountMinor: number, currency: string) {
  if (currency === 'CLP') {
    return amountMinor;
  }
  const decimals = drinkPriceDecimals(currency);
  return amountMinor / 10 ** decimals;
}

export function drinkPriceToMinor(displayAmount: number, currency: string) {
  if (currency === 'CLP') {
    return Math.max(0, Math.round(displayAmount));
  }
  const decimals = drinkPriceDecimals(currency);
  return Math.max(0, Math.round(displayAmount * 10 ** decimals));
}

export function resolveDrinkServiceFeeMinor(currency: string) {
  if (currency === 'CLP') {
    return 1000;
  }
  if (currency === 'USD') {
    return 100;
  }
  return 0;
}
