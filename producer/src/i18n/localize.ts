import type { EventCategoryTone, TicketCategoryId } from '../features/events/types';
import type { LoyaltyTier } from '../features/users/types';
import type { Messages } from './en';
import type { TranslateFn } from './translate';

export type GenderId = 'male' | 'female' | 'nonBinary';

export type PageKey = keyof Messages['meta']['pages'];

export function eventCategoryLabel(t: TranslateFn, tone: EventCategoryTone) {
  return t(`eventCategories.${tone}`);
}

export function ticketCategoryLabel(t: TranslateFn, id: TicketCategoryId) {
  return t(`eventDetail.categories.${id}`);
}

export function genderLabel(t: TranslateFn, id: GenderId) {
  return t(`demographics.gender.${id}`);
}

export function countryLabel(t: TranslateFn, id: string) {
  if (id === 'other') {
    return t('demographics.otherCountries');
  }

  const key = `demographics.countries.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

export function loyaltyTierLabel(t: TranslateFn, tier: LoyaltyTier) {
  return t(`users.loyalty.${tier}`);
}

export function documentTitle(t: TranslateFn, page: PageKey) {
  return t('meta.documentTitle', { page: t(`meta.pages.${page}`) });
}
