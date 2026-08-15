import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { IconChevronDown, IconSend, IconShield } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { FrequentClient } from './eventFrequentClientsDemo';
import {
  COURTESY_ENTRY_TYPES,
  courtesyEntryIcon,
  type CourtesyEntryType,
} from './eventCourtesyInvitationTypes';

type Props = {
  open: boolean;
  client: FrequentClient | null;
  sending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (entryType: CourtesyEntryType) => void;
};

export function EventCourtesyInvitationModal({
  open,
  client,
  sending,
  error,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [entryType, setEntryType] = useState<CourtesyEntryType | ''>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setEntryType('');
      setDropdownOpen(false);
    }
  }, [open, client?.id]);

  if (!client) {
    return null;
  }

  const SelectedIcon = entryType ? courtesyEntryIcon(entryType) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventInvitations.courtesyModal.title')}
      titleIcon={<IconSend />}
      closeLabel={t('eventInvitations.courtesyModal.close')}
      contentClassName="modal__panel event-courtesy-invitation-modal"
      backdropClassName="modal__backdrop event-courtesy-invitation-modal__backdrop"
      error={error}
    >
      <div className="event-courtesy-invitation">
        <p className="event-courtesy-invitation__intro">
          {t('eventInvitations.courtesyModal.introBefore')}{' '}
          <strong>{client.name}</strong>
          {t('eventInvitations.courtesyModal.introAfter')}
        </p>

        <div className="event-courtesy-invitation__field">
          <span className="event-courtesy-invitation__label">
            {t('eventInvitations.courtesyModal.entryTypeLabel')}
          </span>
          <div className="event-courtesy-invitation__select-wrap">
            <button
              type="button"
              className={`event-courtesy-invitation__select${dropdownOpen ? ' is-open' : ''}`}
              onClick={() => setDropdownOpen((current) => !current)}
              aria-expanded={dropdownOpen}
            >
              {SelectedIcon ? <SelectedIcon className="event-courtesy-invitation__select-icon" /> : null}
              <span>
                {entryType
                  ? t(`eventInvitations.courtesyModal.entryTypes.${entryType}`)
                  : t('eventInvitations.courtesyModal.entryTypePlaceholder')}
              </span>
              <IconChevronDown />
            </button>

            {dropdownOpen ? (
              <ul className="event-courtesy-invitation__options" role="listbox">
                {COURTESY_ENTRY_TYPES.map((type) => {
                  const OptionIcon = courtesyEntryIcon(type);
                  const active = entryType === type;
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`event-courtesy-invitation__option${active ? ' is-active' : ''}`}
                        onClick={() => {
                          setEntryType(type);
                          setDropdownOpen(false);
                        }}
                      >
                        <OptionIcon />
                        <span>{t(`eventInvitations.courtesyModal.entryTypes.${type}`)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="primary-btn event-courtesy-invitation__confirm"
          disabled={!entryType || sending}
          onClick={() => entryType && onConfirm(entryType)}
        >
          <IconSend />
          {sending
            ? t('eventInvitations.courtesyModal.sending')
            : t('eventInvitations.courtesyModal.confirm')}
        </button>

        <p className="event-courtesy-invitation__note">
          <IconShield />
          <span>{t('eventInvitations.courtesyModal.whatsappNote')}</span>
        </p>
      </div>
    </Modal>
  );
}
