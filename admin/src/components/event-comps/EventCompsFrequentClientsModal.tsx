import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminUser, type ProducerSuggestedCandidate } from '../../api/client';
import { normalizeInvitationPhone } from '../event-invitations/eventInvitationForm';
import { LoadingBlock } from '../ui/LoadingBlock';
import { Alert } from '../ui/Alert';
import { Modal } from '../ui/Modal';
import { IconChevronLeft, IconChevronRight, IconSend, IconStar } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import {
  formatFrequentClientClp,
  guestInitials,
  visiblePages,
  YOUPASS_TIERS,
  type FrequentClient,
  type YoupassTier,
} from '../event-invitations/eventFrequentClientsDemo';
import { EventCompsSendCourtesyModal } from './EventCompsSendCourtesyModal';
import { buildCreateCompBody } from './eventCompsForm';
import { DEMO_COMP_PRODUCTS } from './eventCompsFormConstants';

const PAGE_SIZE = 10;

type Props = {
  open: boolean;
  eventId: string;
  producerId: string;
  users: AdminUser[];
  invitedPhones: Set<string>;
  onClose: () => void;
  onSent?: (message: string) => void;
};

function mapCandidateToClient(
  candidate: ProducerSuggestedCandidate,
  users: AdminUser[],
  index: number,
): FrequentClient {
  const matchedUser = users.find((user) => user.phone === candidate.guest_phone);
  const tiers: YoupassTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const tier = candidate.reason.toLowerCase().includes('gold') ? 'gold' : tiers[index % tiers.length];

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

function buildProductBenefit(products: Array<{ name: string; quantity: number }>) {
  return products.map((item) => `${item.quantity}x ${item.name}`).join(', ');
}

export function EventCompsFrequentClientsModal({
  open,
  eventId,
  producerId,
  users,
  invitedPhones,
  onClose,
  onSent,
}: Props) {
  const { t, numberLocale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<FrequentClient[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<Set<YoupassTier>>(new Set(YOUPASS_TIERS));
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'info' | 'error' } | null>(null);
  const [sendClient, setSendClient] = useState<FrequentClient | null>(null);
  const [sendAllOpen, setSendAllOpen] = useState(false);
  const [sending, setSending] = useState(false);

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

      const result = await adminApi.producerSuggestedCandidates(producerId, eventId, 50);
      if (cancelled) {
        return;
      }

      const apiClients =
        result.ok && result.data?.candidates
          ? result.data.candidates.map((candidate, index) => mapCandidateToClient(candidate, users, index))
          : [];

      setClients(apiClients);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, producerId, eventId, users]);

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
  const allTiersSelected = selectedTiers.size === YOUPASS_TIERS.length;

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

  async function sendCourtesy(
    client: FrequentClient,
    products: Array<{ name: string; quantity: number }>,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const body = buildCreateCompBody({
      eventId,
      name: client.name,
      phone: client.phone,
      type: 'open_bar',
      benefit: buildProductBenefit(products),
      issueDate: today,
      timeFrom: '22:00',
      timeTo: '04:00',
      userId: client.userId,
    });

    return adminApi.createInvitation(producerId, body);
  }

  async function handleConfirmSend(products: Array<{ name: string; quantity: number }>) {
    const isBatch = sendAllOpen;
    if (!isBatch && !sendClient) {
      return;
    }

    setSending(true);

    if (isBatch) {
      let sent = 0;
      for (const client of filteredClients) {
        const result = await sendCourtesy(client, products);
        if (result.ok) {
          sent += 1;
        }
      }
      const successText = t('eventComps.frequentClientsModal.sendAllSuccess', { count: sent });
      setMessage({ text: successText, tone: sent > 0 ? 'success' : 'error' });
      onSent?.(successText);
    } else if (sendClient) {
      const result = await sendCourtesy(sendClient, products);
      const successText = result.ok
        ? t('eventComps.frequentClientsModal.sendSuccess', { name: sendClient.name })
        : (result.error ?? t('eventComps.frequentClientsModal.sendError'));
      setMessage({ text: successText, tone: result.ok ? 'success' : 'error' });
      if (result.ok) {
        onSent?.(successText);
      }
    }

    setSendClient(null);
    setSendAllOpen(false);
    setSending(false);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('eventComps.frequentClients')}
        subtitle={t('eventComps.frequentClientsModal.subtitle')}
        titleIcon={<IconStar />}
        headerAction={
          <button
            type="button"
            className="event-frequent-clients__send-all"
            disabled={filteredClients.length === 0 || !producerId}
            onClick={() => {
              setMessage(null);
              setSendAllOpen(true);
            }}
          >
            <IconSend />
            {t('eventComps.frequentClientsModal.sendAll')}
          </button>
        }
        closeLabel={t('eventComps.frequentClientsModal.close')}
        contentClassName="modal__panel event-frequent-clients-modal"
        backdropClassName="modal__backdrop event-frequent-clients-modal__backdrop"
      >
        <div className="event-frequent-clients">
          <div className="event-frequent-clients__filters event-frequent-clients__filters--comps">
            <div className="event-frequent-clients__tier-filters">
              <strong>{t('eventComps.frequentClientsModal.filterCategory')}</strong>
              <div className="event-frequent-clients__tier-options">
                {YOUPASS_TIERS.map((tier) => (
                  <label key={tier} className="event-frequent-clients__tier-option">
                    <input type="checkbox" checked={selectedTiers.has(tier)} onChange={() => toggleTier(tier)} />
                    <IconStar className={`event-frequent-clients__tier-star event-frequent-clients__tier-star--${tier}`} />
                    <span>{t(`eventComps.frequentClientsModal.tiers.${tier}`)}</span>
                  </label>
                ))}
                <label className="event-frequent-clients__tier-option event-frequent-clients__tier-option--all">
                  <input type="checkbox" checked={allTiersSelected} onChange={(event) => toggleAllTiers(event.target.checked)} />
                  <span>{t('eventComps.frequentClientsModal.selectAll')}</span>
                </label>
              </div>
            </div>
          </div>

          {message ? (
            <Alert tone={message.tone === 'error' ? 'error' : message.tone === 'success' ? 'success' : 'info'} className="event-frequent-clients__alert">
              {message.text}
            </Alert>
          ) : null}

          {loading ? (
            <LoadingBlock label={t('eventComps.frequentClientsModal.loading')} />
          ) : filteredClients.length === 0 ? (
            <p className="event-frequent-clients__empty">{t('eventComps.frequentClientsModal.empty')}</p>
          ) : (
            <>
              <div className="event-frequent-clients__table-wrap">
                <table className="event-frequent-clients__table">
                  <thead>
                    <tr>
                      <th>{t('eventComps.frequentClientsModal.columns.name')}</th>
                      <th>{t('eventComps.frequentClientsModal.columns.phone')}</th>
                      <th>{t('eventComps.frequentClientsModal.columns.attendance')}</th>
                      <th>{t('eventComps.frequentClientsModal.columns.avgTicket')}</th>
                      <th>{t('eventComps.frequentClientsModal.columns.category')}</th>
                      <th aria-label={t('eventComps.columns.actions')} />
                    </tr>
                  </thead>
                  <tbody>
                    {pageClients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <div className="event-frequent-clients__guest">
                            <span className="event-frequent-clients__avatar event-frequent-clients__avatar--fallback">
                              {guestInitials(client.name)}
                            </span>
                            <strong>{client.name}</strong>
                          </div>
                        </td>
                        <td>{client.phone}</td>
                        <td>{t('eventComps.frequentClientsModal.attendanceCount', { count: client.attendanceCount })}</td>
                        <td>{formatFrequentClientClp(client.avgTicketClp, numberLocale)}</td>
                        <td>
                          <span className={`event-frequent-clients__badge event-frequent-clients__badge--${client.tier}`}>
                            {t(`eventComps.frequentClientsModal.badges.${client.tier}`)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="event-frequent-clients__send-btn"
                            disabled={sending || !producerId}
                            onClick={() => {
                              setSendAllOpen(false);
                              setSendClient(client);
                            }}
                          >
                            <IconSend />
                            {t('eventComps.frequentClientsModal.sendCourtesy')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="event-frequent-clients__pagination">
                <p>
                  {t('eventComps.frequentClientsModal.pagination', {
                    from: new Intl.NumberFormat(numberLocale).format(from),
                    to: new Intl.NumberFormat(numberLocale).format(to),
                    total: new Intl.NumberFormat(numberLocale).format(filteredClients.length),
                  })}
                </p>
                <div className="event-frequent-clients__pagination-controls">
                  <button type="button" className="outline-btn outline-btn--sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    <IconChevronLeft />
                  </button>
                  {pageNumbers.map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={number === page ? 'event-invitations-pagination__page event-invitations-pagination__page--active' : 'event-invitations-pagination__page'}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  ))}
                  <button type="button" className="outline-btn outline-btn--sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    <IconChevronRight />
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </Modal>

      <EventCompsSendCourtesyModal
        open={sendClient !== null || sendAllOpen}
        client={sendAllOpen ? null : sendClient}
        batchRecipientCount={sendAllOpen ? filteredClients.length : undefined}
        products={DEMO_COMP_PRODUCTS}
        sending={sending}
        onClose={() => {
          if (!sending) {
            setSendClient(null);
            setSendAllOpen(false);
          }
        }}
        onConfirm={(selected) => void handleConfirmSend(selected)}
      />
    </>
  );
}
