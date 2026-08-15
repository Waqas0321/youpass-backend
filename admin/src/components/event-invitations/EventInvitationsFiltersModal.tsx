import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { INVITATION_STATUS_FILTER_OPTIONS } from './eventInvitationForm';
import type { InvitationDisplayStatus } from './eventInvitationsUtils';

type Props = {
  open: boolean;
  selectedStatuses: Set<InvitationDisplayStatus>;
  onClose: () => void;
  onApply: (statuses: Set<InvitationDisplayStatus>) => void;
};

export function EventInvitationsFiltersModal({
  open,
  selectedStatuses,
  onClose,
  onApply,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Set<InvitationDisplayStatus>>(() => new Set(selectedStatuses));

  useEffect(() => {
    if (open) {
      setDraft(new Set(selectedStatuses));
    }
  }, [open, selectedStatuses]);

  function toggle(status: InvitationDisplayStatus) {
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
      title={t('eventInvitations.filtersModal.title')}
      subtitle={t('eventInvitations.filtersModal.subtitle')}
      closeLabel={t('eventInvitations.filtersModal.close')}
      contentClassName="modal__panel event-invitations-filters-modal"
      footer={
        <div className="event-invitations-create-form__footer">
          <button type="button" className="ghost-btn" onClick={() => setDraft(new Set())}>
            {t('eventInvitations.filtersModal.clear')}
          </button>
          <button
            type="button"
            className="primary-btn event-invitations-create-form__submit"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t('eventInvitations.filtersModal.apply')}
          </button>
        </div>
      }
    >
      <ul className="event-invitations-filters">
        {INVITATION_STATUS_FILTER_OPTIONS.map((status) => (
          <li key={status}>
            <label className="event-invitations-filters__option">
              <input
                type="checkbox"
                checked={draft.has(status)}
                onChange={() => toggle(status)}
              />
              <span className={`event-invitations-status event-invitations-status--${status}`}>
                <span className="event-invitations-status__dot" />
                {t(`eventInvitations.status.${status}`)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
