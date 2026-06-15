import { env } from '../../config/env.js';

export function buildWaitlistOfferDeepLink(eventId: string, offerId?: string): string {
  const base = env.APP_DEEP_LINK_BASE.replace(/\/$/, '');
  if (offerId) {
    return `${base}/waitlist/offers/${offerId}`;
  }
  return `${base}/events/${eventId}/waitlist`;
}
