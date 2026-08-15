import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { Modal } from '../ui/Modal';
import { IconChevronDown, IconPlus, IconUserPlus } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import {
  INVITATION_LIST_OPTIONS,
  INVITATION_TYPE_OPTIONS,
} from './eventInvitationCreateListDemo';
import { buildCreateInvitationBody } from './eventInvitationForm';

type Props = {
  open: boolean;
  eventId: string;
  producerId: string;
  onClose: () => void;
  onCreated: () => void;
  onCreateList: () => void;
};

export function EventInvitationCreateModal({
  open,
  eventId,
  producerId,
  onClose,
  onCreated,
  onCreateList,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [listAssignment, setListAssignment] = useState('');
  const [invitationType, setInvitationType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName('');
    setPhone('');
    setListAssignment('');
    setInvitationType('');
    setSaving(false);
    setError('');
  }, [open]);

  const canSubmit = Boolean(
    producerId && eventId && name.trim() && phone.trim() && listAssignment && invitationType,
  );

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSaving(true);
    setError('');

    const body = buildCreateInvitationBody({
      eventId,
      name,
      phone,
      listAssignment,
      invitationType,
    });

    const result = await adminApi.createInvitation(producerId, body);
    if (!result.ok) {
      setError(result.error ?? t('eventInvitations.createError'));
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventInvitations.createModalTitle')}
      subtitle={t('eventInvitations.createModalSubtitle')}
      closeLabel={t('eventInvitations.createModalClose')}
      error={error}
      contentClassName="modal__panel event-invitations-create-modal"
      footer={
        <div className="event-invitations-create-form__footer">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
            {t('eventInvitations.createModalCancel')}
          </button>
          <button
            type="button"
            className="primary-btn event-invitations-create-form__submit"
            disabled={saving || !canSubmit}
            onClick={() => void handleSubmit()}
          >
            {saving ? t('eventInvitations.createModalSaving') : t('eventInvitations.createModalSubmit')}
          </button>
        </div>
      }
    >
      <div className="event-invitations-create-form">
        <label className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">
            {t('eventInvitations.createModal.fields.name')}
            <span className="event-invitations-create-form__required">*</span>
          </span>
          <span className="event-invitations-create-form__name-input">
            <IconUserPlus />
            <input
              type="text"
              value={name}
              placeholder={t('eventInvitations.createModal.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </span>
        </label>

        <label className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">
            {t('eventInvitations.createModal.fields.phone')}
            <span className="event-invitations-create-form__required">*</span>
          </span>
          <span className="event-invitations-create-form__phone">
            <span className="event-invitations-create-form__phone-prefix" aria-hidden="true">
              <span className="event-invitations-create-form__flag">🇨🇱</span>
              +56
              <IconChevronDown />
            </span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              placeholder={t('eventInvitations.createModal.phonePlaceholder')}
              onChange={(event) => setPhone(event.target.value)}
            />
          </span>
        </label>

        <div className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">
            {t('eventInvitations.createModal.fields.list')}
            <span className="event-invitations-create-form__required">*</span>
          </span>
          <div className="event-invitations-create-form__field-row">
            <label className="event-invitations-create-form__select">
              <select
                value={listAssignment}
                onChange={(event) => setListAssignment(event.target.value)}
              >
                <option value="">{t('eventInvitations.createModal.selectList')}</option>
                {INVITATION_LIST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`eventInvitations.${option.labelKey}`)}
                  </option>
                ))}
              </select>
              <IconChevronDown />
            </label>
            <button type="button" className="event-invitations-create-form__inline-btn" onClick={onCreateList}>
              <IconPlus />
              {t('eventInvitations.createModal.createList')}
            </button>
          </div>
        </div>

        <div className="event-invitations-create-form__field">
          <span className="event-invitations-create-form__label">
            {t('eventInvitations.createModal.fields.type')}
            <span className="event-invitations-create-form__required">*</span>
          </span>
          <label className="event-invitations-create-form__select">
            <select
              value={invitationType}
              onChange={(event) => setInvitationType(event.target.value)}
            >
              <option value="">{t('eventInvitations.createModal.selectType')}</option>
              {INVITATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`eventInvitations.${option.labelKey}`)}
                </option>
              ))}
            </select>
            <IconChevronDown />
          </label>
        </div>
      </div>
    </Modal>
  );
}
