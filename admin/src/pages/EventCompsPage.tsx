import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminApi,
  AdminUser,
  getSession,
  Producer,
  ProducerInvitation,
  saveSession,
} from '../api/client';
import { normalizeInvitationPhone } from '../components/event-invitations/eventInvitationForm';
import { EventCompsActionBar } from '../components/event-comps/EventCompsActionBar';
import { EventCompsBulkBar } from '../components/event-comps/EventCompsBulkBar';
import { EventCompsCreateBatchModal } from '../components/event-comps/EventCompsCreateBatchModal';
import { EventCompsCreateModal } from '../components/event-comps/EventCompsCreateModal';
import { EventCompsEditModal } from '../components/event-comps/EventCompsEditModal';
import { EventCompsFiltersModal } from '../components/event-comps/EventCompsFiltersModal';
import { EventCompsFrequentClientsModal } from '../components/event-comps/EventCompsFrequentClientsModal';
import { EventCompsOverviewPanel } from '../components/event-comps/EventCompsOverviewPanel';
import { EventCompsTable } from '../components/event-comps/EventCompsTable';
import { EventCompsToolbar } from '../components/event-comps/EventCompsToolbar';
import { EventCompsViewModal } from '../components/event-comps/EventCompsViewModal';
import {
  buildCreateCompBody,
  buildUpdateCompBody,
  countCompsByStatus,
  countCompsByType,
  filterCompsByStatus,
  filterCompsByType,
  isCompInvitation,
  mapInvitationToComp,
} from '../components/event-comps/eventCompsForm';
import { filterComps, visiblePages, type Comp, type CompStatusId, type CompTypeId } from '../components/event-comps/eventCompsUtils';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { Alert } from '../components/ui/Alert';
import { IconChevronLeft, IconChevronRight, IconGift } from '../components/ui/Icons';
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
      return { ok: false as const, error: result.error ?? 'Failed to load complimentary perks' };
    }
    all.push(...(result.data.invitations ?? []));
    totalPages = result.data.pagination.total_pages;
    page += 1;
  }

  return { ok: true as const, invitations: all };
}

export function EventCompsPage() {
  const { eventId = '' } = useParams();
  const { t, numberLocale } = useI18n();
  const session = getSession();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [producerId, setProducerId] = useState(session?.producerId ?? '');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeType, setActiveType] = useState<CompTypeId | 'all'>('all');
  const [statusFilters, setStatusFilters] = useState<Set<CompStatusId>>(new Set());
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [frequentClientsOpen, setFrequentClientsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewComp, setViewComp] = useState<Comp | null>(null);
  const [editComp, setEditComp] = useState<Comp | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeType, statusFilters]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [producersResult, usersResult] = await Promise.all([adminApi.producers(), adminApi.users()]);
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
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadComps() {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (!producerId) {
      setComps([]);
      setError(t('eventComps.noProducer'));
      setLoading(false);
      return;
    }

    saveSession({ apiKey: session?.apiKey ?? '', producerId });
    const result = await fetchAllEventInvitations(producerId, eventId);

    if (!result.ok) {
      setError(result.error);
      setComps([]);
    } else {
      const mapped = result.invitations
        .filter(isCompInvitation)
        .map(mapInvitationToComp)
        .filter((comp): comp is Comp => comp !== null);
      setComps(mapped);
      setError('');
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadComps();
  }, [eventId, producerId, session?.apiKey]);

  const filteredComps = useMemo(() => {
    let rows = filterCompsByType(comps, activeType);
    rows = filterCompsByStatus(rows, statusFilters);
    rows = filterComps(rows, debouncedSearch);
    return rows;
  }, [activeType, comps, debouncedSearch, statusFilters]);

  const typeCounts = useMemo(() => countCompsByType(comps), [comps]);
  const statusCounts = useMemo(() => countCompsByStatus(comps), [comps]);

  const invitedPhones = useMemo(() => {
    const phones = new Set<string>();
    for (const comp of comps) {
      if (comp.phone) {
        phones.add(normalizeInvitationPhone(comp.phone));
      }
    }
    return phones;
  }, [comps]);

  const totalPages = Math.max(1, Math.ceil(filteredComps.length / PAGE_SIZE));
  const pageComps = filteredComps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filteredComps.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filteredComps.length);
  const pageNumbers = visiblePages(page, totalPages);

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(pageComps.map((item) => item.id)) : new Set());
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

  function exportComps() {
    const rows = [
      ['Code', 'Beneficiary', 'Phone', 'Type', 'Benefit', 'Status', 'Created', 'Used', 'Claim Link'].join(','),
      ...filteredComps.map((comp) =>
        [comp.code, comp.beneficiary_name, comp.phone, comp.type, comp.benefit, comp.status, comp.created_at, comp.used_at ?? '', comp.deep_link ?? '']
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    downloadCsv(rows.join('\n'), `comps-${eventId}.csv`);
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
    setActiveType('all');
    setStatusFilters(new Set());
  }

  const hasActiveFilters = Boolean(search.trim()) || activeType !== 'all' || statusFilters.size > 0;

  async function handleResend(comp: Comp) {
    if (!producerId || actionBusy) {
      return;
    }
    setActionBusy(true);
    const result = await adminApi.resendInvitation(producerId, comp.id);
    setMessage(result.ok ? t('eventComps.resendSuccess', { code: comp.code }) : (result.error ?? t('eventComps.resendError')));
    if (result.ok) {
      await loadComps();
    }
    setActionBusy(false);
  }

  async function handleInvalidate(comp: Comp) {
    if (!producerId || actionBusy) {
      return;
    }
    if (!window.confirm(t('eventComps.invalidateConfirm', { code: comp.code }))) {
      return;
    }
    setActionBusy(true);
    const result = await adminApi.revokeInvitation(producerId, comp.id);
    setMessage(result.ok ? t('eventComps.invalidateSuccess', { code: comp.code }) : (result.error ?? t('eventComps.revokeError')));
    if (result.ok) {
      await loadComps();
    }
    setActionBusy(false);
  }

  async function handleDelete(comp: Comp) {
    await handleInvalidate(comp);
  }

  async function handleEditSave(payload: {
    name: string;
    phone: string;
    type: CompTypeId;
    benefit: string;
    issueDate: string;
    timeFrom: string;
    timeTo: string;
  }) {
    if (!producerId || !editComp) {
      return;
    }

    setEditSaving(true);
    setEditError('');

    const body = buildUpdateCompBody({
      name: payload.name,
      type: payload.type,
      benefit: payload.benefit,
      issueDate: payload.issueDate,
      timeFrom: payload.timeFrom,
      timeTo: payload.timeTo,
      existing: {
        kind: 'complimentary',
        comp_type: editComp.type,
        benefit: editComp.benefit,
        issue_date: editComp.issue_date ?? payload.issueDate,
        time_from: editComp.time_from ?? payload.timeFrom,
        time_to: editComp.time_to ?? payload.timeTo,
        comp_code: editComp.code,
      },
    });

    const result = await adminApi.updateInvitation(producerId, editComp.id, body);
    if (!result.ok) {
      setEditError(result.error ?? t('eventComps.editError'));
      setEditSaving(false);
      return;
    }

    setMessage(t('eventComps.editSuccess'));
    setEditComp(null);
    setEditSaving(false);
    await loadComps();
  }

  async function handleBulkWhatsApp() {
    if (!producerId || selectedIds.size === 0 || actionBusy) {
      return;
    }
    setActionBusy(true);
    let sent = 0;
    for (const id of selectedIds) {
      const result = await adminApi.resendInvitation(producerId, id);
      if (result.ok) {
        sent += 1;
      }
    }
    setMessage(sent > 0 ? t('eventComps.bulkResendSuccess', { count: sent }) : t('eventComps.resendError'));
    setActionBusy(false);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !producerId) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes('beneficiary') ? lines.slice(1) : lines;

      setActionBusy(true);
      let created = 0;
      const today = new Date().toISOString().slice(0, 10);

      for (const line of dataLines) {
        const parts = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
        const [name, phone, type = 'general', benefit = 'Complimentary perk'] = parts;
        if (!name || !phone) {
          continue;
        }

        const body = buildCreateCompBody({
          eventId,
          name,
          phone,
          type: (type as CompTypeId) || 'general',
          benefit,
          issueDate: today,
          timeFrom: '22:00',
          timeTo: '04:00',
        });

        const result = await adminApi.createInvitation(producerId, body);
        if (result.ok) {
          created += 1;
        }
      }

      setMessage(t('eventComps.importSuccess', { count: created }));
      setActionBusy(false);
      if (created > 0) {
        await loadComps();
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return (
    <EventWorkspacePage
      pageTitle={t('eventComps.title')}
      pageSubtitle={t('eventComps.subtitle')}
      pageTitleIcon={<IconGift />}
      headerActions={
        <EventCompsActionBar
          onFrequentClients={() => setFrequentClientsOpen(true)}
          onCreateComp={() => setCreateOpen(true)}
          onCreateBatch={() => setBatchOpen(true)}
        />
      }
      loadingLabel={t('eventComps.loading')}
      notFoundLabel={t('eventComps.notFound')}
    >
      <div className="event-comps-page">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <EventCompsToolbar
          search={search}
          onSearchChange={setSearch}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        <EventCompsOverviewPanel
          typeCounts={typeCounts}
          statusCounts={statusCounts}
          activeType={activeType}
          statusFilters={statusFilters}
          onTypeClick={setActiveType}
          onStatusClick={(status) => {
            setStatusFilters((current) => {
              const next = new Set(current);
              if (next.has(status)) {
                next.delete(status);
              } else {
                next.add(status);
              }
              return next;
            });
          }}
        />

        {loading ? (
          <LoadingBlock label={t('eventComps.loading')} />
        ) : (
          <>
            <EventCompsTable
              comps={pageComps}
              selectedIds={selectedIds}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onSend={(comp) => void handleResend(comp)}
              onView={setViewComp}
              onCancel={(comp) => void handleInvalidate(comp)}
              onEdit={setEditComp}
              onDelete={(comp) => void handleDelete(comp)}
            />

            <footer className="event-comps-pagination">
              <p>
                {t('eventComps.pagination', {
                  from: new Intl.NumberFormat(numberLocale).format(from),
                  to: new Intl.NumberFormat(numberLocale).format(to),
                  total: new Intl.NumberFormat(numberLocale).format(filteredComps.length),
                })}
              </p>
              <div className="event-comps-pagination__controls">
                <button type="button" className="outline-btn outline-btn--sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <IconChevronLeft />
                </button>
                {pageNumbers.map((number, index) => {
                  const prev = pageNumbers[index - 1];
                  const gap = prev !== undefined && number - prev > 1;
                  return (
                    <span key={number} className="event-comps-pagination__group">
                      {gap ? <span className="event-comps-pagination__ellipsis">…</span> : null}
                      <button
                        type="button"
                        className={number === page ? 'event-comps-pagination__page event-comps-pagination__page--active' : 'event-comps-pagination__page'}
                        onClick={() => setPage(number)}
                      >
                        {number}
                      </button>
                    </span>
                  );
                })}
                <button type="button" className="outline-btn outline-btn--sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  <IconChevronRight />
                </button>
              </div>
            </footer>
          </>
        )}

        {hasActiveFilters ? (
          <button type="button" className="ghost-btn" onClick={clearFilters}>
            {t('eventComps.clearFilters')}
          </button>
        ) : null}

        <EventCompsBulkBar
          onCreateBatch={() => setBatchOpen(true)}
          onImport={() => importInputRef.current?.click()}
          onWhatsApp={() => void handleBulkWhatsApp()}
          onExport={exportComps}
        />

        <input ref={importInputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => void handleImportFile(event)} />

        <EventCompsCreateModal
          open={createOpen}
          eventId={eventId}
          producerId={producerId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setMessage(t('eventComps.createSuccess'));
            void loadComps();
          }}
        />

        <EventCompsCreateBatchModal
          open={batchOpen}
          eventId={eventId}
          producerId={producerId}
          onClose={() => setBatchOpen(false)}
          onCreated={(count) => {
            setMessage(t('eventComps.batchSuccess', { count }));
            void loadComps();
          }}
        />

        <EventCompsFrequentClientsModal
          open={frequentClientsOpen}
          eventId={eventId}
          producerId={producerId}
          users={users}
          invitedPhones={invitedPhones}
          onClose={() => setFrequentClientsOpen(false)}
          onSent={(text) => {
            setMessage(text);
            void loadComps();
          }}
        />

        <EventCompsFiltersModal
          open={filtersOpen}
          selectedStatuses={statusFilters}
          onClose={() => setFiltersOpen(false)}
          onApply={setStatusFilters}
        />

        <EventCompsViewModal open={viewComp !== null} comp={viewComp} onClose={() => setViewComp(null)} />

        <EventCompsEditModal
          open={editComp !== null}
          comp={editComp}
          saving={editSaving}
          error={editError}
          onClose={() => {
            if (!editSaving) {
              setEditComp(null);
              setEditError('');
            }
          }}
          onSave={(payload) => void handleEditSave(payload)}
        />
      </div>
    </EventWorkspacePage>
  );
}
