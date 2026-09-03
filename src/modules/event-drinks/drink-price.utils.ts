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
  // Drink / in-event product checkout has no service fee.
  // Ticket sales keep their own service fee path.
  void currency;
  return 0;
}
