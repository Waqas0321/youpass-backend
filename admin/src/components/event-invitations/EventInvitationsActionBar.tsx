import { useI18n } from '../../i18n/useI18n';
import { IconPlus, IconStar } from '../ui/Icons';

type Props = {
  onFrequentClients: () => void;
  onCreateInvitation: () => void;
  onCreateList: () => void;
};

export function EventInvitationsActionBar({
  onFrequentClients,
  onCreateInvitation,
  onCreateList,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="event-workspace__header-action-group">
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--gold-outline"
        onClick={onFrequentClients}
      >
        <IconStar />
        {t('eventInvitations.frequentClients')}
      </button>
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--purple-outline"
        onClick={onCreateInvitation}
      >
        <IconPlus />
        {t('eventInvitations.createInvitation')}
      </button>
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--purple-solid"
        onClick={onCreateList}
      >
        <IconPlus />
        {t('eventInvitations.createList')}
      </button>
    </div>
  );
}
