import { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  type AdminEvent,
  type AdminUser,
  type ProducerSuggestedCandidate,
} from '../../api/client';
import { LoadingBlock } from '../ui/LoadingBlock';
import { Alert } from '../ui/Alert';
import { Modal } from '../ui/Modal';
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSend,
  IconStar,
} from '../ui/Icons';
import { EventCourtesyInvitationModal } from './EventCourtesyInvitationModal';
import type { CourtesyEntryType } from './eventCourtesyInvitationTypes';
import { courtesyEntrySlotLabel } from './eventCourtesyInvitationTypes';
import { useI18n } from '../../i18n/useI18n';
import {
  formatFrequentClientClp,
  guestInitials,
  visiblePages,
  YOUPASS_TIERS,
  type FrequentClient,
  type YoupassTier,
} from './eventFrequentClientsDemo';
import { buildCreateInvitationBody, normalizeInvitationPhone } from './eventInvitationForm';

const PAGE_SIZE = 8;

type Props = {
  open: boolean;
  eventId: string;
  producerId: string;
  events: AdminEvent[];
  users: AdminUser[];
  invitedPhones: Set<string>;
  onClose: () => void;
  onInvitationsChanged?: () => void;
};

function mapCandidateToClient(
  candidate: ProducerSuggestedCandidate,
  users: AdminUser[],
  index: number,
): FrequentClient {
  const matchedUser = users.find((user) => user.phone === candidate.guest_phone);
  const tiers: YoupassTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const tier =
    candidate.reason.toLowerCase().includes('gold')
      ? 'gold'
      : tiers[index % tiers.length];

  return {
    id: `api-${candidate.guest_phone}`,
    userId: matchedUser?.id,
    name: candidate.guest_name,
    phone: candidate.guest_phone,
    attendanceCount: candidate.past_attendance_count,
    avgTicketClp: 45_000 + candidate.score * 500,
    tier,
  };
}

export function EventFrequentClientsModal({
  open,
  eventId,
  producerId,
  events,
  users,
  invitedPhones,
  onClose,
  onInvitationsChanged,
}: Props) {
  const { t, numberLocale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<FrequentClient[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<Set<YoupassTier>>(new Set(YOUPASS_TIERS));
  const [eventFilter, setEventFilter] = useState(eventId);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'info' | 'error' } | null>(null);
  const [courtesyClient, setCourtesyClient] = useState<FrequentClient | null>(null);
  const [courtesyError, setCourtesyError] = useState('');
  const [courtesySending, setCourtesySending] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);

  useEffect(() => {
    if (open) {
      setEventFilter(eventId);
    }
  }, [open, eventId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage(null);
      setPage(1);
      setSelectedTiers(new Set(YOUPASS_TIERS));

      if (!producerId) {
        setClients([]);
        setLoading(false);
        return;
      }

      const targetEventId = eventFilter === 'all' ? eventId : eventFilter;
      const result = await adminApi.producerSuggestedCandidates(producerId, targetEventId, 50);
      if (cancelled) {
        return;
      }

      const apiClients =
        result.ok && result.data?.candidates
          ? result.data.candidates.map((candidate, index) =>
              mapCandidateToClient(candidate, users, index),
            )
          : [];

      setClients(apiClients);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, producerId, eventId, eventFilter, users]);

  const allTiersSelected = selectedTiers.size === YOUPASS_TIERS.length;

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (!selectedTiers.has(client.tier)) {
        return false;
      }
      return !invitedPhones.has(normalizeInvitationPhone(client.phone));
    });
  }, [clients, invitedPhones, selectedTiers]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const pageClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filteredClients.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filteredClients.length);
  const pageNumbers = visiblePages(page, totalPages);

  function toggleTier(tier: YoupassTier) {
    setSelectedTiers((current) => {
      const next = new Set(current);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
    setPage(1);
  }

  function toggleAllTiers(checked: boolean) {
    setSelectedTiers(checked ? new Set(YOUPASS_TIERS) : new Set());
    setPage(1);
  }

  async function sendCourtesy(client: FrequentClient, entryType: CourtesyEntryType) {
    const targetEventId = eventFilter === 'all' ? eventId : eventFilter;
    const listAssignment = courtesyEntrySlotLabel(entryType);
    const body = buildCreateInvitationBody({
      eventId: targetEventId,
      name: client.name,
      phone: client.phone,
      listAssignment,
      invitationType: entryType,
      userId: client.userId,
    });

    return adminApi.createInvitation(producerId, body);
  }

  async function handleConfirmCourtesy(entryType: CourtesyEntryType) {
    if (!courtesyClient || !producerId) {
      return;
    }

    setCourtesySending(true);
    setCourtesyError('');

    const result = await sendCourtesy(courtesyClient, entryType);
    if (!result.ok) {
      setCourtesyError(
        result.error?.includes('already has an active invitation')
          ? t('eventInvitations.frequentClientsModal.alreadyInvited')
          : (result.error ?? t('eventInvitations.frequentClientsModal.sendError')),
      );
      setCourtesySending(false);
      return;
    }

    setMessage({
      text: t('eventInvitations.frequentClientsModal.sendSuccess', { name: courtesyClient.name }),
      tone: 'success',
    });
    setCourtesyClient(null);
    setCourtesySending(false);
    onInvitationsChanged?.();
  }

  async function handleSendAll() {
    if (!producerId || filteredClients.length === 0) {
      return;
    }

    setSendingAll(true);
    let sent = 0;

    for (const client of filteredClients) {
      const result = await sendCourtesy(client, 'general');
      if (result.ok) {
        sent += 1;
      }
    }

    setMessage({
      text:
        sent > 0
          ? t('eventInvitations.frequentClientsModal.sendAllSuccess', { count: sent })
          : t('eventInvitations.frequentClientsModal.sendError'),
      tone: sent > 0 ? 'success' : 'error',
    });
    setSendingAll(false);
    if (sent > 0) {
      onInvitationsChanged?.();
    }
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventInvitations.frequentClients')}
      subtitle={t('eventInvitations.frequentClientsModal.subtitle')}
      titleIcon={<IconStar />}
      headerAction={
        <button
          type="button"
          className="event-frequent-clients__send-all"
          onClick={() => void handleSendAll()}
          disabled={filteredClients.length === 0 || sendingAll || !producerId}
        >
          <IconSend />
          {sendingAll
            ? t('eventInvitations.frequentClientsModal.sendingAll')
            : t('eventInvitations.frequentClientsModal.sendAll')}
        </button>
      }
      closeLabel={t('eventInvitations.frequentClientsModal.close')}
      contentClassName="modal__panel event-frequent-clients-modal"
      backdropClassName="modal__backdrop event-frequent-clients-modal__backdrop"
    >
      <div className="event-frequent-clients">
        <div className="event-frequent-clients__filters">
          <div className="event-frequent-clients__tier-filters">
            <strong>{t('eventInvitations.frequentClientsModal.filterCategory')}</strong>
            <div className="event-frequent-clients__tier-options">
              {YOUPASS_TIERS.map((tier) => (
                <label key={tier} className="event-frequent-clients__tier-option">
                  <input
                    type="checkbox"
                    checked={selectedTiers.has(tier)}
                    onChange={() => toggleTier(tier)}
                  />
                  <IconStar className={`event-frequent-clients__tier-star event-frequent-clients__tier-star--${tier}`} />
                  <span>{t(`eventInvitations.frequentClientsModal.tiers.${tier}`)}</span>
                </label>
              ))}
              <label className="event-frequent-clients__tier-option event-frequent-clients__tier-option--all">
                <input
                  type="checkbox"
                  checked={allTiersSelected}
                  onChange={(event) => toggleAllTiers(event.target.checked)}
                />
                <span>{t('eventInvitations.frequentClientsModal.selectAll')}</span>
              </label>
            </div>
          </div>

          <div className="event-frequent-clients__event-filter">
            <strong>{t('eventInvitations.frequentClientsModal.filterEvent')}</strong>
            <label className="event-frequent-clients__event-select">
              <IconCalendar />
              <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
                <option value="all">{t('eventInvitations.frequentClientsModal.allEvents')}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
              <IconChevronDown />
            </label>
          </div>
        </div>

        {message ? (
          <Alert tone={message.tone === 'error' ? 'error' : message.tone === 'success' ? 'success' : 'info'} className="event-frequent-clients__alert">
            {message.text}
          </Alert>
        ) : null}

        {loading ? (
          <LoadingBlock label={t('eventInvitations.frequentClientsModal.loading')} />
        ) : filteredClients.length === 0 ? (
          <p className="event-frequent-clients__empty">{t('eventInvitations.frequentClientsModal.empty')}</p>
        ) : (
          <>
            <div className="event-frequent-clients__table-wrap">
              <table className="event-frequent-clients__table">
                <thead>
                  <tr>
                    <th>{t('eventInvitations.frequentClientsModal.columns.name')}</th>
                    <th>{t('eventInvitations.frequentClientsModal.columns.phone')}</th>
                    <th>{t('eventInvitations.frequentClientsModal.columns.attendance')}</th>
                    <th>{t('eventInvitations.frequentClientsModal.columns.avgTicket')}</th>
                    <th>{t('eventInvitations.frequentClientsModal.columns.category')}</th>
                    <th aria-label={t('eventInvitations.columns.actions')} />
                  </tr>
                </thead>
                <tbody>
                  {pageClients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <div className="event-frequent-clients__guest">
                          {client.avatarUrl ? (
                            <img src={client.avatarUrl} alt="" className="event-frequent-clients__avatar" />
                          ) : (
                            <span className="event-frequent-clients__avatar event-frequent-clients__avatar--fallback">
                              {guestInitials(client.name)}
                            </span>
                          )}
                          <strong>{client.name}</strong>
                        </div>
                      </td>
                      <td>{client.phone}</td>
                      <td>
                        {t('eventInvitations.frequentClientsModal.attendanceCount', {
                          count: client.attendanceCount,
                        })}
                      </td>
                      <td>{formatFrequentClientClp(client.avgTicketClp, numberLocale)}</td>
                      <td>
                        <span className={`event-frequent-clients__badge event-frequent-clients__badge--${client.tier}`}>
                          {t(`eventInvitations.frequentClientsModal.badges.${client.tier}`)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="event-frequent-clients__send-btn"
                          disabled={(courtesySending && courtesyClient?.id === client.id) || !producerId}
                          onClick={() => {
                            setCourtesyError('');
                            setCourtesyClient(client);
                          }}
                        >
                          <IconSend />
                          {t('eventInvitations.frequentClientsModal.sendCourtesy')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="event-frequent-clients__pagination">
              <p>
                {t('eventInvitations.frequentClientsModal.pagination', {
                  from: new Intl.NumberFormat(numberLocale).format(from),
                  to: new Intl.NumberFormat(numberLocale).format(to),
                  total: new Intl.NumberFormat(numberLocale).format(filteredClients.length),
                })}
              </p>
              <div className="event-frequent-clients__pagination-controls">
                <button
                  type="button"
                  className="outline-btn outline-btn--sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <IconChevronLeft />
                </button>
                {pageNumbers.map((number, index) => {
                  const prev = pageNumbers[index - 1];
                  const gap = prev !== undefined && number - prev > 1;
                  return (
                    <span key={number} className="event-invitations-pagination__group">
                      {gap ? <span className="event-invitations-pagination__ellipsis">…</span> : null}
                      <button
                        type="button"
                        className={
                          number === page
                            ? 'event-invitations-pagination__page event-invitations-pagination__page--active'
                            : 'event-invitations-pagination__page'
                        }
                        onClick={() => setPage(number)}
                      >
                        {number}
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  className="outline-btn outline-btn--sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  <IconChevronRight />
                </button>
                <label className="event-invitations-pagination__size">
                  <span>{t('eventInvitations.show')}</span>
                  <select value={PAGE_SIZE} disabled aria-label={t('eventInvitations.show')}>
                    <option value={8}>8</option>
                  </select>
                </label>
              </div>
            </footer>
          </>
        )}
      </div>
    </Modal>

    <EventCourtesyInvitationModal
      open={courtesyClient !== null}
      client={courtesyClient}
      sending={courtesySending}
      error={courtesyError}
      onClose={() => {
        if (!courtesySending) {
          setCourtesyClient(null);
          setCourtesyError('');
        }
      }}
      onConfirm={(entryType) => void handleConfirmCourtesy(entryType)}
    />
    </>
  );
}
