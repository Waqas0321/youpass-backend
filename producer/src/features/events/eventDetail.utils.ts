import type { ProducerEvent, TicketCategoryId } from './types';

export function computeSalesSummary(event: ProducerEvent) {
  const available = Math.max(event.capacity - event.ticketsSold, 0);
  const soldPct = event.capacity > 0 ? (event.ticketsSold / event.capacity) * 100 : 0;
  const availablePct = event.capacity > 0 ? (available / event.capacity) * 100 : 0;

  return { available, soldPct, availablePct };
}

export function categorySoldPct(sold: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return (sold / total) * 100;
}

export function categoryShareOfTotal(sold: number, totalSold: number) {
  if (totalSold <= 0) {
    return 0;
  }
  return (sold / totalSold) * 100;
}

export function ticketCategoryLabelKey(id: TicketCategoryId) {
  return `categories.${id}` as const;
}

export function donutSlicesFromCategories(event: ProducerEvent) {
  return event.ticketCategories
    .filter((category) => category.sold > 0)
    .map((category) => ({
      label: category.id,
      value: category.sold,
      color: category.color,
    }));
}
