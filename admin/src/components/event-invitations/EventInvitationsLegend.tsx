import { useI18n } from '../../i18n/useI18n';

const STATUS_KEYS = [
  'pending',
  'confirmed',
  'rejected',
  'entered',
  'no_show',
  'invalid_qr',
] as const;

type Props = {
  totalGuests: number;
};

export function EventInvitationsLegend({ totalGuests }: Props) {
  const { t, numberLocale } = useI18n();

  return (
    <div className="event-invitations-meta">
      <div className="event-invitations-legend">
        <strong>{t('eventInvitations.legendTitle')}</strong>
        <div className="event-invitations-legend__items">
          {STATUS_KEYS.map((key) => (
            <span key={key} className={`event-invitations-legend__item event-invitations-legend__item--${key}`}>
              <span className="event-invitations-legend__dot" />
              {t(`eventInvitations.status.${key}`)}
            </span>
          ))}
        </div>
      </div>

      <article className="event-invitations-total-card">
        <div>
          <span>{t('eventInvitations.totalGuests')}</span>
          <strong>{new Intl.NumberFormat(numberLocale).format(totalGuests)}</strong>
          <small>{t('eventInvitations.totalGuestsHint')}</small>
        </div>
        <svg className="event-invitations-total-card__sparkline" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points="0,22 18,18 36,20 54,12 72,14 90,8 120,4"
          />
        </svg>
      </article>
    </div>
  );
}
