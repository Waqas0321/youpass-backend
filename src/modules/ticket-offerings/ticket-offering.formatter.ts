import type { EventTicketOffering } from '@prisma/client';
import {
  mapsToCatalogType,
  mapsToTier,
  offeringSection,
  resolveOfferingAvailability,
  soldQuantity,
} from '../ticket-offerings/ticket-offering.types.js';

export function formatPublicTicketOffering(
  offering: EventTicketOffering,
  eventCurrency?: string,
  now = new Date(),
) {
  const availability = resolveOfferingAvailability(offering, now);
  const section = offeringSection(offering.type);

  return {
    id: offering.type,
    offering_id: offering.id,
    event_id: offering.eventId,
    type: offering.type,
    name: offering.name,
    slug: offering.type,
    label: offering.name,
    section,
    price: offering.price,
    currency: eventCurrency ?? offering.currency,
    display_order: offering.displayOrder,
    status: offering.status,
    sale_start_at: offering.saleStartAt?.toISOString() ?? null,
    sale_end_at: offering.saleEndAt?.toISOString() ?? null,
    sale_starts_at: offering.saleStartAt?.toISOString() ?? null,
    sale_ends_at: offering.saleEndAt?.toISOString() ?? null,
    maps_to_tier: mapsToTier(offering.type),
    maps_to_type: mapsToCatalogType(offering.type),
    is_sold_out: availability.is_sold_out,
    is_selectable: availability.is_selectable,
    is_active: offering.status === 'active',
  };
}

/** @deprecated Use formatPublicTicketOffering — stock fields are admin-only. */
export function formatTicketOffering(
  offering: EventTicketOffering,
  eventCurrency?: string,
  now = new Date(),
) {
  return formatPublicTicketOffering(offering, eventCurrency, now);
}

export function formatAdminTicketOffering(
  offering: EventTicketOffering,
  eventCurrency?: string,
  now = new Date(),
) {
  const formatted = formatPublicTicketOffering(offering, eventCurrency, now);
  const sold = soldQuantity(offering);
  return {
    offering_id: offering.id,
    event_id: offering.eventId,
    type: offering.type,
    name: offering.name,
    price: offering.price,
    currency: formatted.currency,
    stock_total: offering.stockTotal,
    stock_remaining: offering.stockRemaining,
    sold_quantity: sold,
    sale_start_at: formatted.sale_start_at,
    sale_end_at: formatted.sale_end_at,
    status: offering.status,
    display_order: offering.displayOrder,
    section: offeringSection(offering.type),
    is_sold_out: formatted.is_sold_out,
    is_selectable: formatted.is_selectable,
    slug: offering.type,
    label: offering.name,
  };
}
