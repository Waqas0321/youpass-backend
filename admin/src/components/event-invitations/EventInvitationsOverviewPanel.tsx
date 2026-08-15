import type { GuestListId } from './eventInvitationsUtils';
import { GUEST_LISTS } from './eventInvitationsUtils';
import { useI18n } from '../../i18n/useI18n';
import {
  IconBriefcase,
  IconCrown,
  IconInfo,
  IconMic,
  IconSpark,
  IconStar,
  IconUsers,
} from '../ui/Icons';

const STATUS_KEYS = [
  'pending',
  'confirmed',
  'rejected',
  'entered',
  'no_show',
  'invalid_qr',
] as const;

type Props = {
  activeList: GuestListId;
  counts: Record<GuestListId, number>;
  totalGuests: number;
  onSelect: (listId: GuestListId) => void;
};

function ListIcon({ listId }: { listId: GuestListId }) {
  switch (listId) {
    case 'rrpp':
      return <IconBriefcase />;
    case 'influencers':
      return <IconStar />;
    case 'staff':
      return <IconUsers />;
    case 'sponsors':
      return <IconSpark />;
    case 'artists':
      return <IconMic />;
    case 'vip':
      return <IconCrown />;
    default:
      return <IconUsers />;
  }
}

export function EventInvitationsOverviewPanel({
  activeList,
  counts,
  totalGuests,
  onSelect,
}: Props) {
  const { t, numberLocale } = useI18n();

  return (
    <section className="event-invitations-overview">
      <div className="event-invitations-overview__lists">
        <header className="event-invitations-overview__heading">
          <span className="event-invitations-overview__heading-icon">
            <IconUsers />
          </span>
          <strong>{t('eventInvitations.availableLists')}</strong>
        </header>
        <div className="event-invitations-overview__list-scroll">
          {GUEST_LISTS.map((list) => {
            const active = activeList === list.id;
            return (
              <button
                key={list.id}
                type="button"
                className={`event-invitations-overview__list-chip${active ? ' is-active' : ''}`}
                onClick={() => onSelect(activeList === list.id ? 'all' : list.id)}
              >
                <span
                  className="event-invitations-overview__list-chip-icon"
                  style={{ backgroundColor: `${list.color}22`, color: list.color }}
                >
                  <ListIcon listId={list.id} />
                </span>
                <span className="event-invitations-overview__list-chip-body">
                  <strong>{t(`eventInvitations.lists.${list.id}`)}</strong>
                  <span>
                    {t('eventInvitations.listGuestCount', {
                      count: new Intl.NumberFormat(numberLocale).format(counts[list.id] ?? 0),
                    })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="event-invitations-overview__legend">
        <header className="event-invitations-overview__legend-head">
          <strong>{t('eventInvitations.legendTitle')}</strong>
          <button type="button" className="event-invitations-overview__info" aria-label={t('eventInvitations.legendInfo')}>
            <IconInfo />
          </button>
        </header>
        <div className="event-invitations-overview__legend-grid">
          {STATUS_KEYS.map((key) => (
            <span
              key={key}
              className={`event-invitations-legend__item event-invitations-legend__item--${key}`}
            >
              <span className="event-invitations-legend__dot" />
              {t(`eventInvitations.status.${key}`)}
            </span>
          ))}
        </div>
      </div>

      <article className="event-invitations-overview__total">
        <span>{t('eventInvitations.totalGuests')}</span>
        <strong>{new Intl.NumberFormat(numberLocale).format(totalGuests)}</strong>
        <small>{t('eventInvitations.totalGuestsHint')}</small>
        <svg className="event-invitations-total-card__sparkline" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points="0,22 18,18 36,20 54,12 72,14 90,8 120,4"
          />
        </svg>
      </article>
    </section>
  );
}
