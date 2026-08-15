import { useI18n } from '../../i18n/useI18n';
import { IconPlus, IconStar } from '../ui/Icons';

type Props = {
  onFrequentClients: () => void;
  onCreateComp: () => void;
  onCreateBatch: () => void;
};

export function EventCompsActionBar({ onFrequentClients, onCreateComp, onCreateBatch }: Props) {
  const { t } = useI18n();

  return (
    <div className="event-workspace__header-action-group">
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--gold-outline"
        onClick={onFrequentClients}
      >
        <IconStar />
        {t('eventComps.frequentClients')}
      </button>
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--purple-outline"
        onClick={onCreateComp}
      >
        <IconPlus />
        {t('eventComps.createComp')}
      </button>
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--purple-solid"
        onClick={onCreateBatch}
      >
        <IconPlus />
        {t('eventComps.createBatch')}
      </button>
    </div>
  );
}
