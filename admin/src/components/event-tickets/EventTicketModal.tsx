import { useI18n } from '../../i18n/useI18n';
import { useTicketForm } from '../../hooks/useTicketForm';
import { Modal } from '../ui/Modal';
import { EventTicketCreateFormFields } from './EventTicketCreateFormFields';
import type { EventTicketRow } from './eventTicketsData';
import type { TicketOfferingType } from './eventTicketOfferingTypes';

type Props = {
  open: boolean;
  eventId: string;
  editingTicket: EventTicketRow | null;
  usedOfferingTypes: TicketOfferingType[];
  onClose: () => void;
  onSaved: () => void;
};

export function EventTicketModal({
  open,
  eventId,
  editingTicket,
  usedOfferingTypes,
  onClose,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const { form, updateForm, saving, error, setError, persistTicket, isEdit } = useTicketForm(
    eventId,
    open,
    editingTicket,
    onSaved,
    onClose,
  );

  const footer = (
    <>
      <button type="button" className="event-ticket-modal__cancel" onClick={onClose}>
        {t('eventTickets.createModal.cancel')}
      </button>
      <div className="event-ticket-modal__footer-actions">
        {!isEdit ? (
          <button
            type="button"
            className="event-ticket-modal__draft"
            disabled={saving}
            onClick={() => void persistTicket(true)}
          >
            {t('eventTickets.createModal.saveDraft')}
          </button>
        ) : null}
        <button
          type="button"
          className="event-ticket-modal__submit"
          disabled={saving}
          onClick={() => void persistTicket(false)}
        >
          {saving
            ? t('eventTickets.createModal.saving')
            : isEdit
              ? t('eventTickets.editModal.save')
              : t('eventTickets.createModal.submit')}
        </button>
      </div>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('eventTickets.editModal.title') : t('eventTickets.createModal.title')}
      subtitle={isEdit ? t('eventTickets.editModal.subtitle') : t('eventTickets.createModal.subtitle')}
      closeLabel={t('eventTickets.createModal.close')}
      titleId="event-ticket-modal-title"
      contentClassName="event-ticket-modal"
      backdropClassName="event-ticket-modal__backdrop"
      error={error}
      footer={footer}
    >
      <EventTicketCreateFormFields
        form={form}
        updateForm={updateForm}
        onError={setError}
        isEdit={isEdit}
        usedOfferingTypes={usedOfferingTypes}
      />
    </Modal>
  );
}
