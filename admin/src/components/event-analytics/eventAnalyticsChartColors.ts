/** Mockup-aligned palettes for analytics donuts. */
export const TICKET_DONUT_COLORS = [
  '#9c5fd4', // General + Cover — purple
  '#6d4fc9', // VIP General — dark purple
  '#f472b6', // VIP DJ — pink
  '#ffb800', // Mesa VIP — orange
  '#3ecf8e', // Cortesias — green
] as const;

export const CONSUMPTION_DONUT_COLORS = [
  '#5b9cf6', // Piscina — blue
  '#4a6fd8', // Gin — indigo
  '#f472b6', // Cervezas — pink
  '#ffb800', // Energéticas — orange
  '#3ecf8e', // Espumantes — green
  '#5eead4', // Agua & Bebidas — teal
] as const;

export const PAYMENT_DONUT_COLORS = [
  '#9c5fd4', // Webpay — purple
  '#5b9cf6', // Tarjeta de crédito — blue
  '#f97316', // Tarjeta de débito — orange
  '#eab308', // Transferencia — yellow
  '#3ecf8e', // Billeteras digitales — green
] as const;

export type DonutPalette = 'tickets' | 'consumption' | 'payment' | 'default';

export function donutColorsFor(palette: DonutPalette): readonly string[] {
  switch (palette) {
    case 'tickets':
      return TICKET_DONUT_COLORS;
    case 'consumption':
      return CONSUMPTION_DONUT_COLORS;
    case 'payment':
      return PAYMENT_DONUT_COLORS;
    default:
      return TICKET_DONUT_COLORS;
  }
}
