import { useEffect, useMemo, useState } from 'react';
import type { AdminStaffMember } from '../../api/client';
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconX,
} from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import {
  permissionColor,
  permissionLabel,
  PermissionIcon,
  STAFF_PERMISSION_CATALOG,
} from './staffQrPermissions';

const PAGE_SIZE = 6;

type Props = {
  open: boolean;
  staff: AdminStaffMember[];
  focusStaffId?: string | null;
  onClose: () => void;
  onStaffChange: (staff: AdminStaffMember[]) => void;
  onPermissionChange: (staffId: string, permissionIds: string[]) => Promise<boolean>;
  roleLabel: (roleId: string) => string;
  zoneLabel: (zone: string) => string;
  roleColor: (roleId: string) => string;
  staffAvatarUrl: (memberId: string) => string;
};

function visiblePages(current: number, total: number, max = 5) {
  if (total <= max) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + max - 1);
  start = Math.max(1, end - max + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function SortableHeader({ label }: { label: string }) {
  return (
    <span className="staff-qr-table__th-label">
      {label}
      <IconChevronDown className="staff-qr-table__sort" aria-hidden="true" />
    </span>
  );
}

export function ManagePermissionsModal({
  open,
  staff,
  focusStaffId,
  onClose,
  onStaffChange,
  onPermissionChange,
  roleLabel,
  zoneLabel,
  roleColor,
  staffAvatarUrl,
}: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addMenuStaffId, setAddMenuStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPage(1);
      setAddMenuStaffId(null);
      return;
    }

    if (!focusStaffId) {
      return;
    }

    const index = staff.findIndex((member) => member.id === focusStaffId);
    if (index >= 0) {
      setSearch('');
      setPage(Math.floor(index / PAGE_SIZE) + 1);
    }
  }, [open, focusStaffId, staff]);

  useEffect(() => {
    if (!addMenuStaffId) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.staff-perm-actions')) return;
      setAddMenuStaffId(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [addMenuStaffId]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;

    return staff.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.phone.toLowerCase().includes(query) ||
        zoneLabel(member.zone).toLowerCase().includes(query) ||
        roleLabel(member.role_id).toLowerCase().includes(query),
    );
  }, [roleLabel, search, staff, zoneLabel]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const pageStaff = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStaff.slice(start, start + PAGE_SIZE);
  }, [filteredStaff, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (!open) {
    return null;
  }

  const from = filteredStaff.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filteredStaff.length);
  const pageNumbers = visiblePages(page, totalPages);

  async function removePermission(staffId: string, permissionId: string) {
    const member = staff.find((item) => item.id === staffId);
    if (!member) {
      return;
    }

    const permissionIds = member.permission_ids.filter((id) => id !== permissionId);
    const saved = await onPermissionChange(staffId, permissionIds);
    if (!saved) {
      return;
    }

    onStaffChange(
      staff.map((item) =>
        item.id === staffId
          ? {
              ...item,
              permission_ids: permissionIds,
            }
          : item,
      ),
    );
  }

  async function addPermission(staffId: string, permissionId: string) {
    const member = staff.find((item) => item.id === staffId);
    if (!member || member.permission_ids.includes(permissionId)) {
      return;
    }

    const permissionIds = [...member.permission_ids, permissionId];
    const saved = await onPermissionChange(staffId, permissionIds);
    if (!saved) {
      return;
    }

    onStaffChange(
      staff.map((item) =>
        item.id === staffId
          ? {
              ...item,
              permission_ids: permissionIds,
            }
          : item,
      ),
    );
    setAddMenuStaffId(null);
  }

  return (
    <div className="staff-qr-modal-backdrop" onClick={onClose}>
      <div
        className="staff-qr-modal staff-qr-modal--permissions"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="staff-perm-modal__top">
          <header className="staff-perm-modal__header">
            <div className="staff-perm-modal__intro">
              <h3>{t('staffQr.permissionsTitle')}</h3>
              <p className="staff-perm-modal__subtitle">{t('staffQr.permissionsSubtitle')}</p>
            </div>
            <button
              type="button"
              className="staff-qr-modal__close staff-perm-modal__close"
              onClick={onClose}
              aria-label={t('staffQr.closeModal')}
            >
              <IconX />
            </button>
          </header>

          <div className="staff-perm-list">
            <div className="staff-perm-search">
              <IconSearch />
              <input
                type="search"
                value={search}
                placeholder={t('staffQr.searchStaff')}
                aria-label={t('staffQr.searchStaff')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="staff-perm-table-wrap">
              <table className="staff-perm-table">
                <thead>
                  <tr>
                    <th>
                      <SortableHeader label={t('staffQr.permColStaff')} />
                    </th>
                    <th>
                      <SortableHeader label={t('staffQr.colZone')} />
                    </th>
                    <th>
                      <SortableHeader label={t('staffQr.colRole')} />
                    </th>
                    <th>{t('staffQr.permColAssigned')}</th>
                    <th>{t('staffQr.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
              {pageStaff.map((member) => {
                const availablePermissions = STAFF_PERMISSION_CATALOG.filter(
                  (permission) => !member.permission_ids.includes(permission.id),
                );

                return (
                  <tr key={member.id}>
                    <td>
                      <div className="staff-qr-member">
                        <img
                          src={staffAvatarUrl(member.id)}
                          alt=""
                          className="staff-qr-member__avatar"
                        />
                        <div>
                          <strong>{member.name}</strong>
                          <span className="staff-qr-phone">{member.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="staff-qr-zone">{zoneLabel(member.zone)}</td>
                    <td>
                      <span
                        className="staff-qr-role-pill"
                        style={{
                          color: roleColor(member.role_id),
                          borderColor: `${roleColor(member.role_id)}44`,
                          background: `${roleColor(member.role_id)}14`,
                        }}
                      >
                        {roleLabel(member.role_id)}
                      </span>
                    </td>
                    <td>
                      <div className="staff-perm-tags">
                        {member.permission_ids.length === 0 ? (
                          <span className="staff-perm-tags__empty">—</span>
                        ) : (
                          member.permission_ids.map((permissionId) => {
                            const color = permissionColor(permissionId);
                            return (
                              <span
                                key={permissionId}
                                className="staff-perm-tag"
                                style={{
                                  borderColor: `${color}55`,
                                  background: `${color}18`,
                                }}
                              >
                                {permissionLabel(permissionId, t)}
                                <button
                                  type="button"
                                  className="staff-perm-tag__remove"
                                  aria-label={t('staffQr.removePermission')}
                                  onClick={() => removePermission(member.id, permissionId)}
                                >
                                  <IconX />
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="staff-perm-actions">
                        <button
                          type="button"
                          className="staff-perm-add-btn"
                          disabled={availablePermissions.length === 0}
                          onClick={() =>
                            setAddMenuStaffId((current) =>
                              current === member.id ? null : member.id,
                            )
                          }
                        >
                          {t('staffQr.addPermissions')}
                        </button>
                        {addMenuStaffId === member.id && availablePermissions.length > 0 ? (
                          <ul className="staff-perm-add-menu">
                            {availablePermissions.map((permission) => {
                              const color = permission.color;
                              return (
                                <li key={permission.id}>
                                  <button
                                    type="button"
                                    onClick={() => addPermission(member.id, permission.id)}
                                  >
                                    <span
                                      className="staff-perm-add-menu__icon"
                                      style={{
                                        color,
                                        background: `${color}18`,
                                        borderColor: `${color}44`,
                                      }}
                                    >
                                      <PermissionIcon permissionId={permission.id} />
                                    </span>
                                    {permissionLabel(permission.id, t)}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </div>
        </div>

        <footer className="staff-qr-pagination staff-perm-pagination">
          <span>
            {t('staffQr.showingStaff', {
              from: String(from),
              to: String(to),
              staff: String(filteredStaff.length),
            })}
          </span>
          <div className="staff-qr-pagination__controls">
            <button
              type="button"
              disabled={page <= 1}
              aria-label={t('staffQr.prevPage')}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
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
              aria-label={t('staffQr.nextPage')}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <IconChevronRight />
            </button>
          </div>
        </footer>

        <section className="staff-perm-available">
          <h4>{t('staffQr.availablePermissionsTitle')}</h4>
          <p className="staff-perm-available__subtitle">{t('staffQr.availablePermissionsSubtitle')}</p>
          <div className="staff-perm-available__list">
            {STAFF_PERMISSION_CATALOG.map((permission) => {
              const color = permission.color;
              return (
                <div key={permission.id} className="staff-perm-available__item">
                  <span
                    className="staff-perm-available__icon"
                    style={{ color, background: `${color}18`, borderColor: `${color}44` }}
                  >
                    <PermissionIcon permissionId={permission.id} />
                  </span>
                  <span>{permissionLabel(permission.id, t)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="staff-qr-modal__footer staff-qr-modal__footer--single">
          <button type="button" className="ghost-btn staff-qr-modal__cancel" onClick={onClose}>
            {t('staffQr.closePermissions')}
          </button>
        </footer>
      </div>
    </div>
  );
}
