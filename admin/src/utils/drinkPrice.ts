import { drinkPriceInputDecimals } from './drinkPriceInput.js';

export function formatDrinkPrice(amount: number, currency = 'CLP', locale = 'en-US') {
  if (amount <= 0) {
    return 'Free (courtesy)';
  }

  if (currency === 'CLP') {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `$${formatted} CLP`;
  }

  const displayAmount = currency === 'USD' ? amount / 100 : amount;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: drinkPriceInputDecimals(currency),
    maximumFractionDigits: drinkPriceInputDecimals(currency),
  }).format(displayAmount);
}

export function formatDrinkPriceClp(clp: number) {
  return formatDrinkPrice(clp, 'CLP');
}
