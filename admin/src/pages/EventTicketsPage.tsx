import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi } from '../api/client';
import { EventTicketModal } from '../components/event-tickets/EventTicketModal';
import { EventTicketsTable } from '../components/event-tickets/EventTicketsTable';
import type { EventTicketRow } from '../components/event-tickets/eventTicketsData';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { useEventTicketOfferings } from '../hooks/useEventTicketOfferings';
import { Alert } from '../components/ui/Alert';
import { IconPlus } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

export function EventTicketsPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<EventTicketRow | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const { tickets, loading, error, reload } = useEventTicketOfferings(eventId);

  function openCreateModal() {
    setEditingTicket(null);
    setModalOpen(true);
  }

  function openEditModal(ticket: EventTicketRow) {
    setEditingTicket(ticket);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTicket(null);
  }

  async function handlePause(ticket: EventTicketRow) {
    const resume = ticket.backendStatus === 'paused';
    if (!resume && !window.confirm(t('eventTickets.confirmPause'))) {
      return;
    }

    setActionError('');
    const result = await adminApi.updateTicketOffering(eventId, ticket.id, {
      status: resume ? 'active' : 'paused',
    });

    if (!result.ok) {
      setActionError(result.error ?? t('eventTickets.actionError'));
      return;
    }

    setActionMessage(resume ? t('eventTickets.resumeSuccess') : t('eventTickets.pauseSuccess'));
    await reload();
  }

  async function handleHide(ticket: EventTicketRow) {
    const show = ticket.backendStatus === 'closed';
    if (!show && !window.confirm(t('eventTickets.confirmHide'))) {
      return;
    }

    setActionError('');
    const result = await adminApi.updateTicketOffering(eventId, ticket.id, {
      status: show ? 'active' : 'closed',
    });

    if (!result.ok) {
      setActionError(result.error ?? t('eventTickets.actionError'));
      return;
    }

    setActionMessage(show ? t('eventTickets.showSuccess') : t('eventTickets.hideSuccess'));
    await reload();
  }

  async function handleDelete(ticket: EventTicketRow) {
    const message =
      ticket.sold > 0
        ? t('eventTickets.confirmDeleteWithSales', { count: String(ticket.sold) })
        : t('eventTickets.confirmDelete');
    if (!window.confirm(message)) {
      return;
    }

    setActionError('');
    const result = await adminApi.deleteTicketOffering(eventId, ticket.id);

    if (!result.ok) {
      setActionError(result.error ?? t('eventTickets.actionError'));
      return;
    }

    setActionMessage(t('eventTickets.deleteSuccess'));
    await reload();
  }

  const headerActions = (
    <button
      type="button"
      className="event-workspace__btn event-workspace__btn--primary"
      onClick={openCreateModal}
    >
      <IconPlus />
      {t('eventTickets.createTicket')}
    </button>
  );

  const usedOfferingTypes = tickets.map((ticket) => ticket.offeringType);

  return (
    <>
      <EventWorkspacePage
        pageTitle={t('eventTickets.title')}
        pageSubtitle={t('eventTickets.subtitle')}
        headerActions={headerActions}
        loadingLabel={t('eventTickets.loading')}
        notFoundLabel={t('eventTickets.notFound')}
      >
        {loading ? (
          <LoadingBlock label={t('eventTickets.loading')} />
        ) : (
          <div className="event-tickets">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {actionError ? <Alert tone="error">{actionError}</Alert> : null}
            {actionMessage ? <Alert tone="success">{actionMessage}</Alert> : null}
            <EventTicketsTable
              tickets={tickets}
              onEdit={openEditModal}
              onPause={handlePause}
              onHide={handleHide}
              onDelete={handleDelete}
            />
          </div>
        )}
      </EventWorkspacePage>

      <EventTicketModal
        open={modalOpen}
        eventId={eventId}
        editingTicket={editingTicket}
        usedOfferingTypes={usedOfferingTypes}
        onClose={closeModal}
        onSaved={() => {
          setActionMessage(
            editingTicket ? t('eventTickets.editModal.saveSuccess') : t('eventTickets.createSuccess'),
          );
          void reload();
        }}
      />
    </>
  );
}
