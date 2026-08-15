import type { GuestListId } from './eventInvitationsUtils';
import { GUEST_LISTS } from './eventInvitationsUtils';
import { useI18n } from '../../i18n/useI18n';
import {
  IconBriefcase,
  IconCrown,
  IconMic,
  IconSpark,
  IconStar,
  IconUsers,
} from '../ui/Icons';

type Props = {
  activeList: GuestListId;
  counts: Record<GuestListId, number>;
  onSelect: (listId: GuestListId) => void;
  onFrequentClients: () => void;
  onCreateInvitation: () => void;
  onCreateList: () => void;
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

export function EventInvitationsListRow({
  activeList,
  counts,
  onSelect,
  onFrequentClients,
  onCreateInvitation,
  onCreateList,
}: Props) {
  const { t, numberLocale } = useI18n();

  return (
    <div className="event-invitations-lists">
      <div className="event-invitations-lists__scroll">
        {GUEST_LISTS.map((list) => {
          const active = activeList === list.id;
          return (
            <button
              key={list.id}
              type="button"
              className={`event-invitations-list-card${active ? ' event-invitations-list-card--active' : ''}`}
              onClick={() => onSelect(activeList === list.id ? 'all' : list.id)}
            >
              <span
                className="event-invitations-list-card__icon"
                style={{ backgroundColor: `${list.color}22`, color: list.color }}
              >
                <ListIcon listId={list.id} />
              </span>
              <span className="event-invitations-list-card__body">
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

      <div className="event-invitations-lists__actions">
        <button type="button" className="outline-btn outline-btn--sm event-invitations-action-btn" onClick={onFrequentClients}>
          <IconStar />
          {t('eventInvitations.frequentClients')}
        </button>
        <button
          type="button"
          className="outline-btn outline-btn--sm event-invitations-action-btn event-invitations-action-btn--purple"
          onClick={onCreateInvitation}
        >
          {t('eventInvitations.createInvitation')}
        </button>
        <button type="button" className="primary-btn event-invitations-action-btn" onClick={onCreateList}>
          {t('eventInvitations.createList')}
        </button>
      </div>
    </div>
  );
}
