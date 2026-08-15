import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminApi,
  AdminEvent,
  AdminUser,
  getSession,
  Producer,
  ProducerInvitation,
  saveSession,
} from '../api/client';
import { EventFrequentClientsModal } from '../components/event-invitations/EventFrequentClientsModal';
import { EventInvitationCreateListModal } from '../components/event-invitations/EventInvitationCreateListModal';
import { EventInvitationCreateModal } from '../components/event-invitations/EventInvitationCreateModal';
import { EventInvitationEditModal } from '../components/event-invitations/EventInvitationEditModal';
import { EventInvitationViewModal } from '../components/event-invitations/EventInvitationViewModal';
import { EventInvitationsActionBar } from '../components/event-invitations/EventInvitationsActionBar';
import { EventInvitationsBulkBar } from '../components/event-invitations/EventInvitationsBulkBar';
import { EventInvitationsFiltersModal } from '../components/event-invitations/EventInvitationsFiltersModal';
import { EventInvitationsOverviewPanel } from '../components/event-invitations/EventInvitationsOverviewPanel';
import { EventInvitationsTable } from '../components/event-invitations/EventInvitationsTable';
import { EventInvitationsToolbar } from '../components/event-invitations/EventInvitationsToolbar';
import { buildCreateInvitationBody, filterByDisplayStatus, normalizeInvitationPhone } from '../components/event-invitations/eventInvitationForm';
import { isCompInvitation } from '../components/event-comps/eventCompsForm';
import {
  countByGuestList,
  filterByGuestList,
  resolveInvitationDisplayStatus,
  type GuestListId,
  type InvitationDisplayStatus,
  visiblePages,
} from '../components/event-invitations/eventInvitationsUtils';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { IconChevronLeft, IconChevronRight, IconMail } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 8;

async function fetchAllEventInvitations(producerId: string, eventId: string) {
  const all: ProducerInvitation[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await adminApi.producerInvitations(producerId, {
      page,
      pageSize: 100,
      eventId,
    });
    if (!result.ok || !result.data) {
      return { ok: false as const, error: result.error ?? 'Failed to load invitations' };
    }
    all.push(...(result.data.invitations ?? []));
    totalPages = result.data.pagination.total_pages;
    page += 1;
  }

  return { ok: true as const, invitations: all };
}

function parseImportCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('name') || first.includes('nombre');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const parts = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
    return {
      name: parts[0] ?? '',
      phone: parts[1] ?? '',
      listAssignment: parts[2] ?? 'General',
      invitationType: parts[3] ?? 'general',
    };
  });
}

export function EventInvitationsPage() {
  const { eventId = '' } = useParams();
  const { t, numberLocale } = useI18n();
  const session = getSession();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [producerId, setProducerId] = useState(session?.producerId ?? '');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [invitations, setInvitations] = useState<ProducerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeList, setActiveList] = useState<GuestListId>('all');
  const [statusFilters, setStatusFilters] = useState<Set<InvitationDisplayStatus>>(new Set());
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [frequentClientsOpen, setFrequentClientsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewInvitation, setViewInvitation] = useState<ProducerInvitation | null>(null);
  const [editInvitation, setEditInvitation] = useState<ProducerInvitation | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeList, statusFilters, sortDirection]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [producersResult, usersResult, eventsResult] = await Promise.all([
        adminApi.producers(),
        adminApi.users(),
        adminApi.events(),
      ]);

      if (cancelled) {
        return;
      }

      if (producersResult.ok) {
        const producers = producersResult.data?.producers ?? [];
        const resolvedProducerId =
          producerId || session?.producerId || (producers[0] as Producer | undefined)?.id || '';
        if (resolvedProducerId && resolvedProducerId !== producerId) {
          setProducerId(resolvedProducerId);
        }
      }

      if (usersResult.ok) {
        setUsers(usersResult.data?.users ?? []);
      }

      if (eventsResult.ok) {
        setEvents(eventsResult.data?.events ?? []);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadInvitations() {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (!producerId) {
      setInvitations([]);
      setError(t('eventInvitations.noProducer'));
      setLoading(false);
      return;
    }

    saveSession({ apiKey: session?.apiKey ?? '', producerId });
    const result = await fetchAllEventInvitations(producerId, eventId);

    if (!result.ok) {
      setError(result.error);
      setInvitations([]);
    } else {
      setInvitations(result.invitations);
      setError('');
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadInvitations();
  }, [eventId, producerId, session?.apiKey]);

  const filteredInvitations = useMemo(() => {
    let rows = invitations.filter((invitation) => !isCompInvitation(invitation));
    rows = filterByGuestList(rows, activeList);
    rows = filterByDisplayStatus(rows, statusFilters, resolveInvitationDisplayStatus);

    if (debouncedSearch) {
      rows = rows.filter((invitation) => {
        const haystack = [
          invitation.recipient_name,
          invitation.recipient_phone,
          invitation.slot_label,
          invitation.assigned_slot,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(debouncedSearch);
      });
    }

    rows = [...rows].sort((left, right) => {
      const leftName = (left.recipient_name ?? '').toLocaleLowerCase();
      const rightName = (right.recipient_name ?? '').toLocaleLowerCase();
      const cmp = leftName.localeCompare(rightName);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [activeList, debouncedSearch, invitations, sortDirection, statusFilters]);

  const listCounts = useMemo(() => countByGuestList(invitations.filter((inv) => !isCompInvitation(inv))), [invitations]);
  const totalGuests = invitations.filter((inv) => !isCompInvitation(inv)).length;

  const invitedPhones = useMemo(() => {
    const phones = new Set<string>();
    for (const invitation of invitations) {
      if (invitation.recipient_phone) {
        phones.add(normalizeInvitationPhone(invitation.recipient_phone));
      }
    }
    return phones;
  }, [invitations]);

  const totalPages = Math.max(1, Math.ceil(filteredInvitations.length / PAGE_SIZE));
  const pageInvitations = filteredInvitations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filteredInvitations.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filteredInvitations.length);
  const pageNumbers = visiblePages(page, totalPages);

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(pageInvitations.map((item) => item.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function exportInvitations() {
    const rows = [
      ['Name', 'Phone', 'List', 'Type', 'Status', 'QR Status', 'Entry Time', 'Claim Link'].join(','),
      ...filteredInvitations.map((invitation) =>
        [
          invitation.recipient_name ?? '',
          invitation.recipient_phone ?? '',
          invitation.slot_label ?? '',
          invitation.invitation_type,
          invitation.lifecycle_state,
          invitation.qr_status ?? '',
          invitation.entry_at ?? '',
          invitation.deep_link ?? '',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    downloadCsv(rows.join('\n'), `invitations-${eventId}.csv`);
  }

  function downloadCsv(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch('');
    setActiveList('all');
    setStatusFilters(new Set());
  }

  const hasActiveFilters =
    Boolean(search.trim()) || activeList !== 'all' || statusFilters.size > 0;

  async function handleResend(invitation: ProducerInvitation) {
    if (!producerId || actionBusy) {
      return;
    }

    setActionBusy(true);
    setMessage('');
    const result = await adminApi.resendInvitation(producerId, invitation.id);
    if (!result.ok) {
      setError(result.error ?? t('eventInvitations.resendError'));
    } else {
      setMessage(t('eventInvitations.resendSuccess', { name: invitation.recipient_name ?? '' }));
      await loadInvitations();
    }
    setActionBusy(false);
  }

  async function handleDelete(invitation: ProducerInvitation) {
    if (!producerId || actionBusy) {
      return;
    }

    const name = invitation.recipient_name ?? t('eventInvitations.unknownGuest');
    if (!window.confirm(t('eventInvitations.deleteConfirm', { name }))) {
      return;
    }

    setActionBusy(true);
    setMessage('');
    const result = await adminApi.revokeInvitation(producerId, invitation.id);
    if (!result.ok) {
      setError(result.error ?? t('eventInvitations.revokeError'));
    } else {
      setMessage(t('eventInvitations.revokeSuccess', { name }));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(invitation.id);
        return next;
      });
      await loadInvitations();
    }
    setActionBusy(false);
  }

  async function handleEditSave(payload: {
    recipient_name: string;
    slot_label: string;
    personalised_message: string;
  }) {
    if (!producerId || !editInvitation) {
      return;
    }

    setEditSaving(true);
    setEditError('');
    const result = await adminApi.updateInvitation(producerId, editInvitation.id, payload);
    if (!result.ok) {
      setEditError(result.error ?? t('eventInvitations.editError'));
      setEditSaving(false);
      return;
    }

    setMessage(t('eventInvitations.editSuccess'));
    setEditInvitation(null);
    setEditSaving(false);
    await loadInvitations();
  }

  async function handleBulkWhatsApp() {
    if (!producerId || selectedIds.size === 0 || actionBusy) {
      return;
    }

    setActionBusy(true);
    setMessage('');
    let sent = 0;

    for (const id of selectedIds) {
      const result = await adminApi.resendInvitation(producerId, id);
      if (result.ok) {
        sent += 1;
      }
    }

    setMessage(
      sent > 0
        ? t('eventInvitations.bulkResendSuccess', { count: sent })
        : t('eventInvitations.resendError'),
    );
    setActionBusy(false);
    if (sent > 0) {
      await loadInvitations();
    }
  }

  function handleGenerateLinks() {
    const targets =
      selectedIds.size > 0
        ? invitations.filter((invitation) => selectedIds.has(invitation.id))
        : filteredInvitations;

    const rows = [
      ['Name', 'Phone', 'Claim Link'].join(','),
      ...targets.map((invitation) =>
        [
          invitation.recipient_name ?? '',
          invitation.recipient_phone ?? '',
          invitation.deep_link ?? '',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];

    downloadCsv(rows.join('\n'), `invitation-links-${eventId}.csv`);
    setMessage(t('eventInvitations.linksExportSuccess', { count: targets.length }));
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !producerId) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const rows = parseImportCsv(text);
      if (rows.length === 0) {
        setError(t('eventInvitations.importEmpty'));
        return;
      }

      setActionBusy(true);
      let created = 0;

      for (const row of rows) {
        if (!row.name.trim() || !row.phone.trim()) {
          continue;
        }

        const body = buildCreateInvitationBody({
          eventId,
          name: row.name,
          phone: row.phone,
          listAssignment: row.listAssignment,
          invitationType: row.invitationType,
        });

        const result = await adminApi.createInvitation(producerId, body);
        if (result.ok) {
          created += 1;
        }
      }

      setMessage(t('eventInvitations.importSuccess', { count: created }));
      setActionBusy(false);
      if (created > 0) {
        await loadInvitations();
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return (
    <EventWorkspacePage
      pageTitle={t('eventInvitations.title')}
      pageSubtitle={t('eventInvitations.subtitle')}
      pageTitleIcon={<IconMail />}
      headerActions={
        <EventInvitationsActionBar
          onFrequentClients={() => setFrequentClientsOpen(true)}
          onCreateInvitation={() => setCreateOpen(true)}
          onCreateList={() => setCreateListOpen(true)}
        />
      }
      loadingLabel={t('eventInvitations.loading')}
      notFoundLabel={t('eventInvitations.notFound')}
    >
      <div className="event-invitations-page">
        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <EventInvitationsToolbar
          search={search}
          onSearchChange={setSearch}
          onOpenFilters={() => setFiltersOpen(true)}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <EventInvitationsOverviewPanel
          activeList={activeList}
          counts={listCounts}
          totalGuests={totalGuests}
          onSelect={setActiveList}
        />

        {loading ? (
          <LoadingBlock label={t('eventInvitations.loadingList')} />
        ) : (
          <>
            <EventInvitationsTable
              invitations={pageInvitations}
              selectedIds={selectedIds}
              sortDirection={sortDirection}
              onSortName={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onSend={(invitation) => void handleResend(invitation)}
              onView={setViewInvitation}
              onEdit={setEditInvitation}
              onDelete={(invitation) => void handleDelete(invitation)}
            />

            <footer className="event-invitations-pagination">
              <p>
                {t('eventInvitations.pagination', {
                  from: new Intl.NumberFormat(numberLocale).format(from),
                  to: new Intl.NumberFormat(numberLocale).format(to),
                  total: new Intl.NumberFormat(numberLocale).format(filteredInvitations.length),
                })}
              </p>
              <div className="event-invitations-pagination__controls">
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

        <EventInvitationsBulkBar
          selectedCount={selectedIds.size}
          onImport={() => importInputRef.current?.click()}
          onWhatsApp={() => void handleBulkWhatsApp()}
          onGenerateLinks={handleGenerateLinks}
          onExport={exportInvitations}
        />

        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => void handleImportFile(event)}
        />

        <EventInvitationCreateModal
          open={createOpen}
          eventId={eventId}
          producerId={producerId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setMessage(t('eventInvitations.createSuccess'));
            void loadInvitations();
          }}
          onCreateList={() => {
            setCreateOpen(false);
            setCreateListOpen(true);
          }}
        />

        <EventInvitationCreateListModal
          open={createListOpen}
          eventId={eventId}
          producerId={producerId}
          onClose={() => setCreateListOpen(false)}
          onCreated={(guestCount) => {
            setMessage(t('eventInvitations.createListModal.success', { count: guestCount }));
            void loadInvitations();
          }}
        />

        <EventFrequentClientsModal
          open={frequentClientsOpen}
          eventId={eventId}
          producerId={producerId}
          events={events}
          users={users}
          invitedPhones={invitedPhones}
          onClose={() => setFrequentClientsOpen(false)}
          onInvitationsChanged={() => void loadInvitations()}
        />

        <EventInvitationsFiltersModal
          open={filtersOpen}
          selectedStatuses={statusFilters}
          onClose={() => setFiltersOpen(false)}
          onApply={setStatusFilters}
        />

        <EventInvitationViewModal
          open={viewInvitation !== null}
          invitation={viewInvitation}
          onClose={() => setViewInvitation(null)}
        />

        <EventInvitationEditModal
          open={editInvitation !== null}
          invitation={editInvitation}
          saving={editSaving}
          error={editError}
          onClose={() => {
            if (!editSaving) {
              setEditInvitation(null);
              setEditError('');
            }
          }}
          onSave={(payload) => void handleEditSave(payload)}
        />
      </div>
    </EventWorkspacePage>
  );
}
