import type { LoyaltyTier } from './types';
import { loyaltyTierLabel } from '../../i18n/localize';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  tier: LoyaltyTier;
};

function LoyaltyIcon({ tier }: { tier: LoyaltyTier }) {
  if (tier === 'diamond') {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5 2 6.5l6 8 6-8-6-5z" />
      </svg>
    );
  }

  if (tier === 'platinum') {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5.5v5M5.5 8h5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 2.5 9.8 6.2l4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L4.2 6.8l4-.6z" />
    </svg>
  );
}

export function LoyaltyBadge({ tier }: Props) {
  const { t } = useI18n();

  return (
    <span className={`prod-users-loyalty prod-users-loyalty--${tier}`}>
      <span className="prod-users-loyalty__icon">
        <LoyaltyIcon tier={tier} />
      </span>
      <span>{loyaltyTierLabel(t, tier)}</span>
    </span>
  );
}
