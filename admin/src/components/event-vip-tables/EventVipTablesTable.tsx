import { useMemo, useState } from 'react';
import { adminApi } from '../../api/client';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconMove,
  IconSort,
  IconUndo,
  IconUsers,
} from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { EventVipTableEditModal } from './EventVipTableEditModal';
import { EventVipTableGuestsModal } from './EventVipTableGuestsModal';
import { EventVipTableMoveModal } from './EventVipTableMoveModal';
import {
  formatDisplayPhone,
  formatVipTablePrice,
  VIP_TABLES_PAGE_SIZE,
  type EventVipTableRow,
  type VipTableStatus,
  type VipZoneOption,
} from './eventVipTablesData';

type Props = {
  eventId: string;
  tables: EventVipTableRow[];
  zones: VipZoneOption[];
  onChanged: () => void;
};

type SortKey = 'number' | 'zone' | 'capacity' | 'status' | 'price' | 'buyer';
type SortDirection = 'asc' | 'desc';

const STATUS_ORDER: Record<VipTableStatus, number> = {
  available: 0,
  reserved: 1,
  paid: 2,
  blocked: 3,
};

function StatusBadge({ status }: { status: VipTableStatus }) {
  const { t } = useI18n();
  return (
    <span className={`event-vip-tables__status event-vip-tables__status--${status}`}>
      {t(`eventVipTables.status.${status}`)}
    </span>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`event-vip-tables__sort${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <IconSort className={direction === 'desc' ? 'is-desc' : undefined} />
    </button>
  );
}

export function EventVipTablesTable({ eventId, tables, zones, onChanged }: Props) {
  const { t, numberLocale } = useI18n();
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [guestsTable, setGuestsTable] = useState<EventVipTableRow | null>(null);
  const [editTable, setEditTable] = useState<EventVipTableRow | null>(null);
  const [moveTable, setMoveTable] = useState<EventVipTableRow | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionTableId, setActionTableId] = useState<string | null>(null);

  const sortedTables = useMemo(() => {
    const copy = [...tables];

    copy.sort((left, right) => {
      let result = 0;

      switch (sortKey) {
        case 'number':
          result = left.number - right.number;
          break;
        case 'zone':
          result = left.zoneLabel.localeCompare(right.zoneLabel);
          break;
        case 'capacity':
          result = left.capacity - right.capacity;
          break;
        case 'status':
          result = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
          break;
        case 'price':
          result = left.price - right.price;
          break;
        case 'buyer':
          result = (left.buyer?.name ?? '').localeCompare(right.buyer?.name ?? '');
          break;
      }

      return sortDirection === 'asc' ? result : -result;
    });

    return copy;
  }, [sortDirection, sortKey, tables]);

  const totalPages = Math.max(1, Math.ceil(sortedTables.length / VIP_TABLES_PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = (page - 1) * VIP_TABLES_PAGE_SIZE;
    return sortedTables.slice(start, start + VIP_TABLES_PAGE_SIZE);
  }, [page, sortedTables]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let index = 1; index <= totalPages; index += 1) {
      pages.push(index);
    }
    return pages;
  }, [totalPages]);

  const from = sortedTables.length === 0 ? 0 : (page - 1) * VIP_TABLES_PAGE_SIZE + 1;
  const to = Math.min(page * VIP_TABLES_PAGE_SIZE, sortedTables.length);

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection('asc');
  }

  function hasBuyer(table: EventVipTableRow) {
    return Boolean(table.buyer);
  }

  function canViewGuests(table: EventVipTableRow) {
    return hasBuyer(table);
  }

  function canEditTable(_table: EventVipTableRow) {
    return true;
  }

  function canMoveTable(table: EventVipTableRow) {
    return table.status !== 'paid' && table.status !== 'blocked';
  }

  function canReserve(table: EventVipTableRow) {
    return !hasBuyer(table) && table.status === 'available';
  }

  function canRelease(table: EventVipTableRow) {
    if (table.status === 'paid') {
      return false;
    }
    return hasBuyer(table) || table.status === 'reserved' || table.status === 'blocked';
  }

  async function handleTableAction(table: EventVipTableRow, action: 'reserve' | 'release') {
    setActionError('');
    setActionTableId(table.id);

    const result = await adminApi.eventVipTableAction(eventId, table.id, action);
    setActionTableId(null);

    if (!result.ok) {
      setActionError(result.error ?? t('eventVipTables.actionError'));
      return;
    }

    onChanged();
  }

  return (
    <>
      {actionError ? <p className="event-vip-tables__error">{actionError}</p> : null}

      <div className="event-vip-tables__table-card">
        <div className="event-vip-tables__table-wrap">
          <table className="event-vip-tables__table">
            <thead>
              <tr>
                <th>
                  <SortableHeader
                    label={t('eventVipTables.columns.number')}
                    active={sortKey === 'number'}
                    direction={sortDirection}
                    onClick={() => toggleSort('number')}
                  />
                </th>
                <th>
                  <SortableHeader
                    label={t('eventVipTables.columns.zone')}
                    active={sortKey === 'zone'}
                    direction={sortDirection}
                    onClick={() => toggleSort('zone')}
                  />
                </th>
                <th>
                  <SortableHeader
                    label={t('eventVipTables.columns.capacity')}
                    active={sortKey === 'capacity'}
                    direction={sortDirection}
                    onClick={() => toggleSort('capacity')}
                  />
                </th>
                <th>
                  <SortableHeader
                    label={t('eventVipTables.columns.status')}
                    active={sortKey === 'status'}
                    direction={sortDirection}
                    onClick={() => toggleSort('status')}
                  />
                </th>
                <th>
                  <SortableHeader
                    label={t('eventVipTables.columns.price')}
                    active={sortKey === 'price'}
                    direction={sortDirection}
                    onClick={() => toggleSort('price')}
                  />
                </th>
                <th>
                  <SortableHeader
                    label={t('eventVipTables.columns.buyer')}
                    active={sortKey === 'buyer'}
                    direction={sortDirection}
                    onClick={() => toggleSort('buyer')}
                  />
                </th>
                <th>{t('eventVipTables.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((table) => (
                <tr key={table.id}>
                  <td>
                    <span className="event-vip-tables__number">{table.number}</span>
                  </td>
                  <td>
                    <span className="event-vip-tables__zone" style={{ color: table.zoneColor }}>
                      {table.zoneLabel}
                    </span>
                  </td>
                  <td>
                    {t('eventVipTables.capacityPeople', {
                      count: String(table.capacity),
                    })}
                  </td>
                  <td>
                    <StatusBadge status={table.status} />
                  </td>
                  <td>
                    <div className="event-vip-tables__price">
                      <strong>{formatVipTablePrice(table.price, table.currency, numberLocale)}</strong>
                    </div>
                  </td>
                  <td>
                    {table.buyer ? (
                      <div className="event-vip-tables__buyer">
                        {table.buyer.avatarUrl ? (
                          <img
                            src={table.buyer.avatarUrl}
                            alt=""
                            className="event-vip-tables__buyer-photo"
                          />
                        ) : (
                          <span className="event-vip-tables__buyer-avatar">{table.buyer.avatarInitials}</span>
                        )}
                        <span className="event-vip-tables__buyer-copy">
                          <strong>{table.buyer.name}</strong>
                          <small>{formatDisplayPhone(table.buyer.phone)}</small>
                        </span>
                      </div>
                    ) : (
                      <span className="event-vip-tables__buyer-empty">—</span>
                    )}
                  </td>
                  <td>
                    <div className="event-vip-tables__actions">
                      <button
                        type="button"
                        className={`event-vip-tables__action${canViewGuests(table) ? '' : ' is-disabled'}`}
                        disabled={!canViewGuests(table)}
                        onClick={() => setGuestsTable(table)}
                      >
                        <IconUsers />
                        <span>{t('eventVipTables.actions.viewGuests')}</span>
                      </button>
                      <button
                        type="button"
                        className="event-vip-tables__action"
                        disabled={!canEditTable(table) || actionTableId === table.id}
                        onClick={() => setEditTable(table)}
                      >
                        <IconEdit />
                        <span>{t('eventVipTables.actions.edit')}</span>
                      </button>
                      <button
                        type="button"
                        className={`event-vip-tables__action${canMoveTable(table) ? '' : ' is-disabled'}`}
                        disabled={!canMoveTable(table) || actionTableId === table.id}
                        onClick={() => setMoveTable(table)}
                      >
                        <IconMove />
                        <span>{t('eventVipTables.actions.move')}</span>
                      </button>
                      <button
                        type="button"
                        className={`event-vip-tables__action event-vip-tables__action--primary${canReserve(table) ? '' : ' is-disabled'}`}
                        disabled={!canReserve(table) || actionTableId === table.id}
                        onClick={() => void handleTableAction(table, 'reserve')}
                      >
                        <IconCalendar />
                        <span>{t('eventVipTables.actions.reserve')}</span>
                      </button>
                      <button
                        type="button"
                        className={`event-vip-tables__action event-vip-tables__action--release${canRelease(table) ? '' : ' is-disabled'}`}
                        disabled={!canRelease(table) || actionTableId === table.id}
                        onClick={() => void handleTableAction(table, 'release')}
                      >
                        <IconUndo />
                        <span>{t('eventVipTables.actions.release')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="event-vip-tables__footer">
          <p>
            {t('eventVipTables.pagination.showing', {
              from: String(from),
              to: String(to),
              total: String(sortedTables.length),
            })}
          </p>
          <div className="event-vip-tables__pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              <IconChevronLeft />
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={pageNumber === page ? 'is-active' : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              <IconChevronRight />
            </button>
          </div>
        </footer>
      </div>

      <EventVipTableGuestsModal
        open={Boolean(guestsTable)}
        eventId={eventId}
        table={guestsTable}
        onClose={() => setGuestsTable(null)}
      />

      <EventVipTableEditModal
        open={Boolean(editTable)}
        eventId={eventId}
        table={editTable}
        onClose={() => setEditTable(null)}
        onSaved={onChanged}
      />

      <EventVipTableMoveModal
        open={Boolean(moveTable)}
        eventId={eventId}
        table={moveTable}
        zones={zones}
        onClose={() => setMoveTable(null)}
        onSaved={onChanged}
      />
    </>
  );
}
