import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { COMP_STATUSES, type CompStatusId } from './eventCompsUtils';

type Props = {
  open: boolean;
  selectedStatuses: Set<CompStatusId>;
  onClose: () => void;
  onApply: (statuses: Set<CompStatusId>) => void;
};

export function EventCompsFiltersModal({ open, selectedStatuses, onClose, onApply }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Set<CompStatusId>>(() => new Set(selectedStatuses));

  useEffect(() => {
    if (open) {
      setDraft(new Set(selectedStatuses));
    }
  }, [open, selectedStatuses]);

  function toggle(status: CompStatusId) {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventComps.filtersModal.title')}
      subtitle={t('eventComps.filtersModal.subtitle')}
      closeLabel={t('eventComps.filtersModal.close')}
      contentClassName="modal__panel event-comps-filters-modal"
      footer={
        <div className="event-comps-create-form__footer">
          <button type="button" className="ghost-btn" onClick={() => setDraft(new Set())}>
            {t('eventComps.filtersModal.clear')}
          </button>
          <button
            type="button"
            className="primary-btn event-comps-create-form__submit"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t('eventComps.filtersModal.apply')}
          </button>
        </div>
      }
    >
      <ul className="event-invitations-filters">
        {COMP_STATUSES.map((status) => (
          <li key={status}>
            <label className="event-invitations-filters__option">
              <input type="checkbox" checked={draft.has(status)} onChange={() => toggle(status)} />
              <span className={`event-comps-qr event-comps-qr--${status}`}>
                {t(`eventComps.status.${status}`)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
