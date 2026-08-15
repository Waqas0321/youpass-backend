import { useEffect, useState } from 'react';
import type { ProducerInvitation } from '../../api/client';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { INVITATION_LIST_OPTIONS } from './eventInvitationOptions';
import { IconChevronDown } from '../ui/Icons';

type Props = {
  open: boolean;
  invitation: ProducerInvitation | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (payload: { recipient_name: string; slot_label: string; personalised_message: string }) => void;
};

export function EventInvitationEditModal({
  open,
  invitation,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [slotLabel, setSlotLabel] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open || !invitation) {
      return;
    }
    setName(invitation.recipient_name ?? '');
    setSlotLabel(invitation.slot_label ?? invitation.assigned_slot ?? '');
    setMessage(invitation.custom_message ?? '');
  }, [open, invitation]);

  if (!invitation) {
    return null;
  }

  const listOptions = [
    ...INVITATION_LIST_OPTIONS.map((option) => option.value),
    slotLabel,
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventInvitations.editModal.title')}
      subtitle={t('eventInvitations.editModal.subtitle')}
      closeLabel={t('eventInvitations.editModal.close')}
      error={error}
      contentClassName="modal__panel event-invitation-edit-modal"
      footer={
        <div className="event-invitations-create-form__footer">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
            {t('eventInvitations.editModal.cancel')}
          </button>
          <button
            type="button"
            className="primary-btn event-invitations-create-form__submit"
            disabled={saving || !name.trim() || !slotLabel.trim()}
            onClick={() =>
              onSave({
                recipient_name: name.trim(),
                slot_label: slotLabel.trim(),
                personalised_message: message.trim(),
              })
            }
          >
            {saving ? t('eventInvitations.editModal.saving') : t('eventInvitations.editModal.save')}
          </button>
        </div>
      }
    >
      <div className="event-invitations-create-form">
        <label className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">{t('eventInvitations.createModal.fields.name')}</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">{t('eventInvitations.createModal.fields.list')}</span>
          <span className="event-invitations-create-form__select">
            <select value={slotLabel} onChange={(event) => setSlotLabel(event.target.value)}>
              {listOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <IconChevronDown />
          </span>
        </label>

        <label className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">{t('eventInvitations.editModal.message')}</span>
          <textarea
            rows={3}
            value={message}
            placeholder={t('eventInvitations.editModal.messagePlaceholder')}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
