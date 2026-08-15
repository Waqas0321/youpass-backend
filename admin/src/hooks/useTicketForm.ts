import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AdminTicketOfferingInput } from '../api/client';
import { useI18n } from '../i18n/useI18n';
import type { EventTicketRow } from '../components/event-tickets/eventTicketsData';
import {
  EMPTY_TICKET_FORM,
  mapTicketFormToOfferingInput,
  ticketRowToFormState,
  type TicketFormState,
} from '../components/event-tickets/eventTicketForm';

function resolveSaveStatus(
  editingTicket: EventTicketRow | null,
  asDraft: boolean,
): AdminTicketOfferingInput['status'] {
  if (editingTicket) {
    if (editingTicket.backendStatus === 'paused') return 'paused';
    if (editingTicket.backendStatus === 'closed') return 'closed';
    if (editingTicket.backendStatus === 'sold_out') return 'sold_out';
    return 'active';
  }
  return asDraft ? 'paused' : 'active';
}

export function useTicketForm(
  eventId: string,
  open: boolean,
  editingTicket: EventTicketRow | null,
  onSuccess: () => void,
  onClose: () => void,
) {
  const { t } = useI18n();
  const isEdit = editingTicket !== null;
  const [form, setForm] = useState<TicketFormState>(EMPTY_TICKET_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_TICKET_FORM);
      setSaving(false);
      setError('');
      return;
    }

    setForm(editingTicket ? ticketRowToFormState(editingTicket) : EMPTY_TICKET_FORM);
    setError('');
  }, [open, editingTicket]);

  const updateForm = useCallback(<K extends keyof TicketFormState>(
    key: K,
    value: TicketFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const persistTicket = useCallback(
    async (asDraft: boolean) => {
      if (!form.name.trim()) {
        setError(t('eventTickets.createModal.nameRequired'));
        return;
      }

      if (!isEdit && !form.offeringType) {
        setError(t('eventTickets.createModal.typeRequired'));
        return;
      }

      const price = Number(form.price);
      if (!Number.isFinite(price) || price <= 0) {
        setError(t('eventTickets.createModal.priceRequired'));
        return;
      }

      setSaving(true);
      setError('');

      const payload = mapTicketFormToOfferingInput(form, resolveSaveStatus(editingTicket, asDraft));

      if (isEdit && editingTicket && payload.stock_total != null) {
        payload.stock_remaining = Math.max(payload.stock_total - editingTicket.sold, 0);
      }

      const result = isEdit
        ? await adminApi.updateTicketOffering(eventId, editingTicket!.id, payload)
        : await adminApi.createTicketOffering(eventId, payload);

      setSaving(false);

      if (!result.ok) {
        setError(
          result.error ??
            t(isEdit ? 'eventTickets.editModal.saveError' : 'eventTickets.createModal.saveError'),
        );
        return;
      }

      onSuccess();
      onClose();
    },
    [editingTicket, eventId, form, isEdit, onClose, onSuccess, t],
  );

  return {
    form,
    updateForm,
    saving,
    error,
    setError,
    persistTicket,
    isEdit,
  };
}
