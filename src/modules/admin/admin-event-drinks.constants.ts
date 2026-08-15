import { resolveDrinkServiceFeeMinor } from '../event-drinks/drink-price.utils.js';

export const DEFAULT_DRINK_CATEGORIES = [
  { slug: 'piscolas', name: 'Piscolas', icon: '🥃', displayOrder: 1 },
  { slug: 'gin', name: 'Gin', icon: '🍸', displayOrder: 2 },
  { slug: 'cervezas', name: 'Cervezas', icon: '🍺', displayOrder: 3 },
  { slug: 'energeticas', name: 'Energéticas', icon: '⚡', displayOrder: 4 },
  { slug: 'espumantes', name: 'Espumantes', icon: '🍾', displayOrder: 5 },
  { slug: 'agua-bebidas', name: 'Agua & bebidas', icon: '💧', displayOrder: 6 },
] as const;

export function resolveDrinkServiceFee(currency: string) {
  return resolveDrinkServiceFeeMinor(currency);
}
