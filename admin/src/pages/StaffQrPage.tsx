import { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  type AdminEventStaffQrDashboard,
  type AdminStaffMember,
  type AdminStaffPermission,
} from '../api/client';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { Alert } from '../components/ui/Alert';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { StaffQrHeader } from '../components/staff-qr/StaffQrHeader';
import { StaffQrAllScansModal } from '../components/staff-qr/StaffQrAllScansModal';
import { StaffQrLiveSidebar } from '../components/staff-qr/StaffQrLiveSidebar';
import {
  AddStaffModal,
  buildStaffZoneOptions,
  type AddStaffFormValues,
} from '../components/staff-qr/AddStaffModal';
import { ManagePermissionsModal } from '../components/staff-qr/ManagePermissionsModal';
import { StaffMemberQrModal } from '../components/staff-qr/StaffMemberQrModal';
import { StaffSupervisorPinModal } from '../components/staff-qr/StaffSupervisorPinModal';
import { StaffQrActionButton } from '../components/staff-qr/StaffQrActionButton';
import {
  permissionLabel,
  PermissionIcon,
} from '../components/staff-qr/staffQrPermissions';
import { StaffRoleSelect } from '../components/staff-qr/StaffRoleSelect';
import { filterAssignableStaffRoles } from '../components/staff-qr/staffRoleOptions';
import { hasSupervisorAccess } from '../components/staff-qr/staffSupervisorPermissions';
import {
  IconCrown,
  IconDrink,
  IconInfo,
  IconLock,
  IconMic,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconRefresh,
  IconShield,
  IconPause,
  IconSpark,
  IconTrash,
  IconUsers,
} from '../components/ui/Icons';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 6;

function formatRelativeTime(iso: string, locale: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (locale.startsWith('es')) {
    return `Hace ${minutes} min`;
  }

  return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
}

function roleLabel(roleId: string, roles: AdminEventStaffQrDashboard['roles'], t: ReturnType<typeof useI18n>['t']) {
  const role = roles.find((item) => item.id === roleId);
  const slug = role?.slug ?? roleId;
  const key = `staffQr.roles.${slug}` as 'staffQr.roles.bartender';
  const translated = t(key);
  if (!translated.startsWith('staffQr.roles.')) {
    return translated;
  }
  return role?.label ?? roleId;
}

function RoleIcon({ roleId, roles }: { roleId: string; roles: AdminEventStaffQrDashboard['roles'] }) {
  const slug = roles.find((role) => role.id === roleId)?.slug ?? roleId;

  switch (slug) {
    case 'bar':
    case 'bartender':
      return <IconDrink />;
    case 'tickets':
    case 'general_access':
      return <IconUsers />;
    case 'vip_staff':
      return <IconSpark />;
    case 'security':
      return <IconShield />;
    case 'promoter':
      return <IconMic />;
    case 'admin':
      return <IconCrown />;
    default:
      return <IconUsers />;
  }
}

function zoneLabel(zone: string, t: ReturnType<typeof useI18n>['t']) {
  const key = zone
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, '_')
    .replace(/^_|_$/g, '');
  const label = t(`staffQr.zones.${key}`);
  return label.startsWith('staffQr.zones.') ? zone : label;
}

function visiblePages(current: number, total: number, max = 5) {
  if (total <= max) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + max - 1);
  start = Math.max(1, end - max + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function formatEfficiencyPct(value: number, locale: string) {
  if (value <= 0) {
    return '—';
  }

  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function staffAvatarUrl(memberId: string) {
  return `https://i.pravatar.cc/96?u=${encodeURIComponent(memberId)}`;
}

function CardTitle({ title, info }: { title: string; info: string }) {
  return (
    <h3 className="staff-qr-card__title">
      <span>{title}</span>
      <button type="button" className="staff-qr-info-btn" title={info} aria-label={info}>
        <IconInfo />
      </button>
    </h3>
  );
}

function staffStatusLabel(status: AdminStaffMember['status'], t: ReturnType<typeof useI18n>['t']) {
  switch (status) {
    case 'online':
      return t('staffQr.statusOnline');
    case 'paused':
      return t('staffQr.statusPaused');
    default:
      return t('staffQr.statusAway');
  }
}

function roleColor(roleId: string, roles: AdminEventStaffQrDashboard['roles']) {
  return roles.find((role) => role.id === roleId)?.color ?? '#ffb800';
}

type StaffQrPanelProps = {
  eventId: string;
  embedded?: boolean;
  onRegisterAddStaff?: (open: () => void) => void;
};

export function StaffQrPanel({ eventId, embedded = false, onRegisterAddStaff }: StaffQrPanelProps) {
  const { t, dateLocale, numberLocale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [data, setData] = useState<AdminEventStaffQrDashboard | null>(null);
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [permissions, setPermissions] = useState<AdminStaffPermission[]>([]);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsFocusStaffId, setPermissionsFocusStaffId] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<{ name: string; image: string } | null>(null);
  const [pinPreview, setPinPreview] = useState<{
    name: string;
    pin: string;
    mode: 'view' | 'reset';
  } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AdminEventStaffQrDashboard['roles']>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [dashboardFetchedAt, setDashboardFetchedAt] = useState<string | undefined>();
  const [showAllScansModal, setShowAllScansModal] = useState(false);

  useEffect(() => {
    onRegisterAddStaff?.(() => setShowAddModal(true));
  }, [onRegisterAddStaff]);

  async function loadDashboard(options?: { silent?: boolean }) {
    if (!eventId) {
      setData(null);
      setStaff([]);
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
      setError('');
    }

    const [dashboardResult, staffResult] = await Promise.all([
      adminApi.eventStaffQr(eventId),
      adminApi.listStaff(),
    ]);

    if (!dashboardResult.ok || !dashboardResult.data) {
      if (!options?.silent) {
        setLoading(false);
        setError(dashboardResult.error ?? t('staffQr.loadError'));
      }
      return;
    }

    setData(dashboardResult.data);
    setDashboardFetchedAt(dashboardResult.data.fetched_at ?? new Date().toISOString());

    if (staffResult.ok && staffResult.data) {
      setStaff(
        staffResult.data.staff.map((member) => ({
          ...member,
          permission_ids: member.permission_ids ?? [],
        })),
      );
      setAvailableRoles(staffResult.data.roles.map((role) => ({ ...role })));
      setAvailableZones(buildStaffZoneOptions(staffResult.data.zones));
    } else {
      setStaff(
        dashboardResult.data.staff.map((member) => ({
          ...member,
          permission_ids: member.permission_ids ?? [],
        })),
      );
      setAvailableRoles(dashboardResult.data.roles.map((role) => ({ ...role })));
      setAvailableZones(buildStaffZoneOptions(dashboardResult.data.staff.map((member) => member.zone)));
    }

    setPermissions(dashboardResult.data.permissions.map((permission) => ({ ...permission })));
    setPage(1);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadDashboard();
      if (cancelled) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, t]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [eventId]);

  async function refreshStaff() {
    const staffResult = await adminApi.listStaff();
    if (!staffResult.ok || !staffResult.data) {
      return;
    }

    setStaff(
      staffResult.data.staff.map((member) => ({
        ...member,
        permission_ids: member.permission_ids ?? [],
      })),
    );
    setAvailableRoles(staffResult.data.roles.map((role) => ({ ...role })));
    setAvailableZones(buildStaffZoneOptions(staffResult.data.zones));
    setPage(1);
  }

  const roles = availableRoles.length > 0 ? availableRoles : (data?.roles ?? []);
  const assignableRoles = useMemo(() => filterAssignableStaffRoles(roles), [roles]);
  const rolesForAddStaff = assignableRoles.length > 0 ? assignableRoles : roles;
  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const pageStaff = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return staff.slice(start, start + PAGE_SIZE);
  }, [page, staff]);

  async function handleAddStaff(values: AddStaffFormValues) {
    const result = await adminApi.createStaff({
      name: values.name,
      phone: values.phone,
      role_id: values.role_id,
      zone: values.zone,
    });

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.staffAddError'));
      return;
    }

    await refreshStaff();
    setShowAddModal(false);
    setQrPreview({ name: result.data.name, image: result.data.qr_image });
    setMessage(t('staffQr.staffAdded'));
  }

  function openPermissionsModal(staffId?: string) {
    setPermissionsFocusStaffId(staffId ?? null);
    setShowPermissionsModal(true);
  }

  function handleClosePermissionsModal() {
    setShowPermissionsModal(false);
    setPermissionsFocusStaffId(null);
  }

  async function handleRoleChange(member: AdminStaffMember, roleId: string) {
    if (member.role_id === roleId) {
      return;
    }

    setActionLoadingId(member.id);
    const result = await adminApi.updateStaff(member.id, { role_id: roleId });
    setActionLoadingId(null);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.staffRoleUpdateError'));
      return;
    }

    setStaff((current) =>
      current.map((item) =>
        item.id === member.id
          ? {
              ...item,
              role_id: result.data!.role_id,
              permission_ids: result.data!.permission_ids ?? item.permission_ids,
            }
          : item,
      ),
    );
    setMessage(t('staffQr.staffRoleUpdated'));
  }

  async function handlePermissionChange(staffId: string, permissionIds: string[]) {
    const result = await adminApi.updateStaff(staffId, { permission_ids: permissionIds });
    if (!result.ok) {
      setMessage(result.error ?? t('staffQr.permissionsUpdateError'));
      return false;
    }

    setMessage(t('staffQr.permissionsSaved'));
    return true;
  }

  async function handleViewSupervisorPin(member: AdminStaffMember) {
    setActionLoadingId(member.id);
    const result = await adminApi.getSupervisorPin(member.id);
    setActionLoadingId(null);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.supervisorPinViewError'));
      return;
    }

    setPinPreview({ name: member.name, pin: result.data.pin, mode: 'view' });
  }

  async function handleResetSupervisorPin(member: AdminStaffMember) {
    if (!window.confirm(t('staffQr.supervisorPinResetConfirm', { name: member.name }))) {
      return;
    }

    setActionLoadingId(member.id);
    const result = await adminApi.resetSupervisorPin(member.id);
    setActionLoadingId(null);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.supervisorPinResetError'));
      return;
    }

    await refreshStaff();
    setPinPreview({ name: member.name, pin: result.data.pin, mode: 'reset' });
    setMessage(t('staffQr.supervisorPinResetSuccess'));
  }

  async function handleGenerateSupervisorPin(member: AdminStaffMember) {
    setActionLoadingId(member.id);
    const result = await adminApi.resetSupervisorPin(member.id);
    setActionLoadingId(null);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.supervisorPinGenerateError'));
      return;
    }

    await refreshStaff();
    setPinPreview({ name: member.name, pin: result.data.pin, mode: 'reset' });
    setMessage(t('staffQr.supervisorPinGenerated'));
  }

  async function handleResetQr(member: AdminStaffMember) {
    setActionLoadingId(member.id);
    const result = await adminApi.resetStaffQr(member.id);
    setActionLoadingId(null);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.staffResetQrError'));
      return;
    }

    await refreshStaff();
    setQrPreview({ name: result.data.name, image: result.data.qr_image });
    setMessage(t('staffQr.staffResetQrSuccess'));
  }

  async function handleTogglePause(member: AdminStaffMember) {
    const nextStatus = member.status === 'paused' ? 'online' : 'paused';
    setActionLoadingId(member.id);
    const result = await adminApi.updateStaff(member.id, { status: nextStatus });
    setActionLoadingId(null);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? t('staffQr.staffPauseError'));
      return;
    }

    setStaff((current) =>
      current.map((item) => (item.id === member.id ? { ...item, status: result.data!.status } : item)),
    );
    setMessage(t('staffQr.staffUpdated'));
  }

  async function handleDeleteStaff(member: AdminStaffMember) {
    if (!window.confirm(t('staffQr.deleteStaffConfirm', { name: member.name }))) {
      return;
    }

    setActionLoadingId(member.id);
    const result = await adminApi.deleteStaff(member.id);
    setActionLoadingId(null);

    if (!result.ok) {
      setMessage(result.error ?? t('staffQr.staffDeleteError'));
      return;
    }

    await refreshStaff();
    setMessage(t('staffQr.staffDeleted'));
  }

  if (loading) {
    if (embedded) {
      return <LoadingBlock label={t('staffQr.loading')} />;
    }

    return (
      <section className="page staff-qr-page">
        <StaffQrHeader onAddStaff={() => setShowAddModal(true)} />
        <LoadingBlock label={t('staffQr.loading')} />
      </section>
    );
  }

  if (error || !data) {
    return <Alert tone="error">{error || t('staffQr.loadError')}</Alert>;
  }

  const from = staff.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, staff.length);
  const activeStaffCount = staff.filter((member) => member.status === 'online').length;
  const zonesCount = new Set(staff.map((member) => member.zone)).size;
  const pageNumbers = visiblePages(page, totalPages);

  return (
    <section className={`page staff-qr-page${embedded ? ' staff-qr-page--embedded' : ''}`}>
      {embedded ? null : <StaffQrHeader onAddStaff={() => setShowAddModal(true)} />}

      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="staff-qr-top-grid">
        <article className="staff-qr-card">
          <CardTitle title={t('staffQr.availableRoles')} info={t('staffQr.rolesInfo')} />
          <ul className="staff-qr-roles">
            {(assignableRoles.length > 0 ? assignableRoles : roles).map((role) => (
              <li key={role.id}>
                <span
                  className="staff-qr-role-icon"
                  style={{ background: role.color }}
                >
                  <RoleIcon roleId={role.id} roles={roles} />
                </span>
                <span>{roleLabel(role.id, roles, t)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="staff-qr-card">
          <CardTitle title={t('staffQr.permissions')} info={t('staffQr.permissionsInfo')} />
          <div className="staff-qr-permissions staff-qr-permissions--overview">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className={`staff-qr-permission staff-qr-permission--tag ${permission.enabled ? 'is-on' : ''}`}
              >
                <span className="staff-qr-permission__icon-wrap">
                  <PermissionIcon permissionId={permission.id} />
                </span>
                {permissionLabel(permission.id, t)}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="staff-qr-manage-btn"
            onClick={() => openPermissionsModal()}
          >
            <IconLock className="staff-qr-manage-btn__icon" />
            {t('staffQr.managePermissions')}
          </button>
        </article>

        <article className="staff-qr-card staff-qr-card--summary">
          <CardTitle title={t('staffQr.teamSummary')} info={t('staffQr.teamSummaryInfo')} />
          <div className="staff-qr-summary-grid">
            <div className="staff-qr-stat staff-qr-stat--green">
              <strong>{new Intl.NumberFormat(numberLocale).format(activeStaffCount)}</strong>
              <span>{t('staffQr.activeStaff')}</span>
              <small>{t('staffQr.activeStaffHint')}</small>
            </div>
            <div className="staff-qr-stat staff-qr-stat--gold">
              <strong>{new Intl.NumberFormat(numberLocale).format(zonesCount)}</strong>
              <span>{t('staffQr.zonesAssigned')}</span>
              <small>{t('staffQr.zonesAssignedHint')}</small>
            </div>
            <div className="staff-qr-stat staff-qr-stat--blue">
              <strong>{new Intl.NumberFormat(numberLocale).format(data.summary.scans_today)}</strong>
              <span>{t('staffQr.scansToday')}</span>
              <small>{t('staffQr.scansTodayHint')}</small>
            </div>
            <div className="staff-qr-stat staff-qr-stat--purple">
              <strong>{formatEfficiencyPct(data.summary.qr_efficiency_pct, numberLocale)}</strong>
              <span>{t('staffQr.qrEfficiency')}</span>
              <small>{t('staffQr.qrEfficiencyHint')}</small>
            </div>
          </div>
        </article>
      </div>

      <div className="staff-qr-main-grid">
        <article className="staff-qr-card staff-qr-card--table">
          <CardTitle title={t('staffQr.activeStaffTable')} info={t('staffQr.activeStaffTableInfo')} />
          <div className="table-wrap">
            <table className="data-table staff-qr-table">
              <thead>
                <tr>
                  <th className="staff-qr-table__th-name">
                    <span className="staff-qr-table__th-label">
                      {t('staffQr.colName')}
                      <button
                        type="button"
                        className="staff-qr-info-btn staff-qr-info-btn--header"
                        title={t('staffQr.colNameInfo')}
                        aria-label={t('staffQr.colNameInfo')}
                      >
                        <IconInfo />
                      </button>
                      <IconChevronDown className="staff-qr-table__sort" aria-hidden="true" />
                    </span>
                  </th>
                  <th>{t('staffQr.colRole')}</th>
                  <th>{t('staffQr.colZone')}</th>
                  <th>{t('staffQr.colStatus')}</th>
                  <th>{t('staffQr.colLastActivity')}</th>
                  <th>{t('staffQr.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageStaff.map((member) => (
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
                    <td>
                      <StaffRoleSelect
                        memberRoleId={member.role_id}
                        roles={roles}
                        disabled={actionLoadingId === member.id}
                        onChange={(roleId) => void handleRoleChange(member, roleId)}
                      />
                    </td>
                    <td className="staff-qr-zone">{zoneLabel(member.zone, t)}</td>
                    <td>
                      <span className={`staff-qr-status staff-qr-status--${member.status}`}>
                        <span className="staff-qr-status__dot" />
                        {staffStatusLabel(member.status, t)}
                      </span>
                    </td>
                    <td className="staff-qr-last-activity">
                      {formatRelativeTime(member.last_activity_at, dateLocale)}
                    </td>
                    <td>
                      <div className="staff-qr-actions">
                        <StaffQrActionButton
                          label={t('staffQr.actionPermissions')}
                          disabled={actionLoadingId === member.id}
                          onClick={() => openPermissionsModal(member.id)}
                        >
                          <IconShield />
                        </StaffQrActionButton>
                        <StaffQrActionButton
                          label={t('staffQr.actionResetQr')}
                          disabled={actionLoadingId === member.id}
                          onClick={() => void handleResetQr(member)}
                        >
                          <IconRefresh />
                        </StaffQrActionButton>
                        {hasSupervisorAccess(member.permission_ids) ? (
                          member.has_supervisor_pin ? (
                            <>
                              <StaffQrActionButton
                                label={t('staffQr.actionViewSupervisorPin')}
                                disabled={actionLoadingId === member.id}
                                onClick={() => void handleViewSupervisorPin(member)}
                              >
                                <IconLock />
                              </StaffQrActionButton>
                              <StaffQrActionButton
                                label={t('staffQr.actionResetSupervisorPin')}
                                disabled={actionLoadingId === member.id}
                                onClick={() => void handleResetSupervisorPin(member)}
                              >
                                <IconRefresh />
                              </StaffQrActionButton>
                            </>
                          ) : (
                            <StaffQrActionButton
                              label={t('staffQr.actionGenerateSupervisorPin')}
                              disabled={actionLoadingId === member.id}
                              onClick={() => void handleGenerateSupervisorPin(member)}
                            >
                              <IconLock />
                            </StaffQrActionButton>
                          )
                        ) : null}
                        <StaffQrActionButton
                          label={
                            member.status === 'paused'
                              ? t('staffQr.actionResume')
                              : t('staffQr.actionPause')
                          }
                          disabled={actionLoadingId === member.id}
                          onClick={() => void handleTogglePause(member)}
                        >
                          <IconPause />
                        </StaffQrActionButton>
                        <StaffQrActionButton
                          label={t('staffQr.actionDelete')}
                          disabled={actionLoadingId === member.id}
                          variant="danger"
                          onClick={() => void handleDeleteStaff(member)}
                        >
                          <IconTrash />
                        </StaffQrActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="staff-qr-pagination">
            <span>
              {t('staffQr.showingStaff', {
                from: String(from),
                to: String(to),
                staff: String(staff.length),
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
        </article>

        <StaffQrLiveSidebar
          data={data}
          fetchedAt={dashboardFetchedAt}
          onViewAll={() => setShowAllScansModal(true)}
        />
      </div>

      <AddStaffModal
        open={showAddModal}
        roles={rolesForAddStaff}
        zones={availableZones}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddStaff}
        onZonesChange={setAvailableZones}
      />

      <ManagePermissionsModal
        open={showPermissionsModal}
        staff={staff}
        focusStaffId={permissionsFocusStaffId}
        onClose={handleClosePermissionsModal}
        onStaffChange={setStaff}
        onPermissionChange={handlePermissionChange}
        roleLabel={(roleId) => roleLabel(roleId, roles, t)}
        zoneLabel={(zone) => zoneLabel(zone, t)}
        roleColor={(roleId) => roleColor(roleId, roles)}
        staffAvatarUrl={staffAvatarUrl}
      />

      <StaffMemberQrModal
        open={qrPreview !== null}
        staffName={qrPreview?.name ?? ''}
        qrImage={qrPreview?.image ?? ''}
        onClose={() => setQrPreview(null)}
      />

      <StaffSupervisorPinModal
        open={pinPreview !== null}
        staffName={pinPreview?.name ?? ''}
        pin={pinPreview?.pin ?? ''}
        mode={pinPreview?.mode ?? 'view'}
        onClose={() => setPinPreview(null)}
      />

      <StaffQrAllScansModal
        open={showAllScansModal}
        eventId={eventId}
        onClose={() => setShowAllScansModal(false)}
      />
    </section>
  );
}

export function StaffQrPage() {
  const { t } = useI18n();
  const { selectedEvent, eventsLoading } = useSelectedEvent();

  if (eventsLoading) {
    return <LoadingBlock label={t('staffQr.loading')} />;
  }

  if (!selectedEvent) {
    return <Alert tone="info">{t('staffQr.noEventSelected')}</Alert>;
  }

  return <StaffQrPanel eventId={selectedEvent.id} />;
}
