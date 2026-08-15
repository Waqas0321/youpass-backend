export const COMP_BENEFIT_MAX_LENGTH = 300;

export const DEMO_COMP_PRODUCTS = [
  {
    id: 'mojito-classic',
    name: 'Mojito Clásico',
    emoji: '🍹',
    maxQuantity: 20,
    accent: '#ef4444',
  },
  {
    id: 'gin-tonic',
    name: 'Gin Tonic',
    emoji: '🥃',
    maxQuantity: 15,
    accent: '#22c55e',
  },
  {
    id: 'pisco-sour',
    name: 'Pisco Sour',
    emoji: '🍋',
    maxQuantity: 12,
    accent: '#fbbf24',
  },
  {
    id: 'open-bar',
    name: 'Open Bar Premium',
    emoji: '🍾',
    maxQuantity: 5,
    accent: '#a855f7',
  },
] as const;

export type DemoCompProductId = (typeof DEMO_COMP_PRODUCTS)[number]['id'];
