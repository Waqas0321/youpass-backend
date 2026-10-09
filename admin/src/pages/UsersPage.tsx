import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  type AdminCustomer,
  type AdminCustomerDetail,
  type AdminCustomersList,
  type AdminCustomersQuery,
  type AdminCustomerUpdate,
} from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { IconBan, IconEdit, IconEye, IconTrash, IconUndo } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusPill } from '../components/ui/StatusPill';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 20;

type ModalState =
  | { kind: 'none' }
  | { kind: 'view'; userId: string }
  | { kind: 'edit'; user: AdminCustomer }
  | { kind: 'block'; user: AdminCustomer }
  | { kind: 'delete'; user: AdminCustomer };

function statusTone(status: AdminCustomer['account_status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'blocked') return 'danger' as const;
  if (status === 'pending_deletion') return 'warning' as const;
  return 'neutral' as const;
}

export function UsersPage() {
  const { t, dateLocale, numberLocale } = useI18n();
  const [query, setQuery] = useState<AdminCustomersQuery>({
    status: 'all',
    sort: 'newest',
    page: 1,
    page_size: PAGE_SIZE,
  });
  const [searchDraft, setSearchDraft] = useState('');
  const [data, setData] = useState<AdminCustomersList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const formatMoney = (value: number) =>
    new Intl.NumberFormat(numberLocale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
      value,
    );
  const formatDate = (iso: string | null, withTime = false) =>
    iso
      ? new Intl.DateTimeFormat(dateLocale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        }).format(new Date(iso))
      : t('usersPage.never');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminApi.customers(query);
    setLoading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? t('usersPage.loadError'));
      return;
    }
    setError('');
    setData(result.data);
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced search.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery((current) =>
        (current.q ?? '') === searchDraft.trim()
          ? current
          : { ...current, q: searchDraft.trim() || undefined, page: 1 },
      );
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  function updateQuery(patch: Partial<AdminCustomersQuery>) {
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  async function afterAction(done: string) {
    setModal({ kind: 'none' });
    setMessage(done);
    await load();
  }

  async function unblock(user: AdminCustomer) {
    const result = await adminApi.unblockCustomer(user.id);
    if (!result.ok) {
      setError(result.error ?? t('usersPage.loadError'));
      return;
    }
    await afterAction(t('usersPage.unblockedDone'));
  }

  const summary = data?.summary;
  const pagination = data?.pagination;
  const from = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.page_size, pagination.total) : 0;

  return (
    <section className="page users-page">
      <PageHeader title={t('usersPage.title')} subtitle={t('usersPage.subtitle')} />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="stat-grid">
        <StatCard label={t('usersPage.kpiTotal')} value={summary?.total_users ?? '—'} tone="gold" />
        <StatCard label={t('usersPage.kpiActive')} value={summary?.active ?? '—'} tone="green" />
        <StatCard label={t('usersPage.kpiBlocked')} value={summary?.blocked ?? '—'} />
        <StatCard label={t('usersPage.kpiPendingDeletion')} value={summary?.pending_deletion ?? '—'} />
        <StatCard label={t('usersPage.kpiNewThisMonth')} value={summary?.new_this_month ?? '—'} tone="purple" />
      </div>

      <div className="table-card">
        <div className="table-card__header users-page__toolbar">
          <input
            className="table-card__search"
            type="search"
            value={searchDraft}
            placeholder={t('usersPage.searchPlaceholder')}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label={t('usersPage.searchPlaceholder')}
          />
          <div className="table-card__tools">
            <label className="users-page__filter">
              <span>{t('usersPage.filterStatus')}</span>
              <select
                value={query.status ?? 'all'}
                onChange={(e) => updateQuery({ status: e.target.value as AdminCustomersQuery['status'] })}
              >
                <option value="all">{t('usersPage.all')}</option>
                <option value="active">{t('usersPage.status.active')}</option>
                <option value="blocked">{t('usersPage.status.blocked')}</option>
                <option value="pending_deletion">{t('usersPage.status.pending_deletion')}</option>
                <option value="deleted">{t('usersPage.status.deleted')}</option>
              </select>
            </label>
            <label className="users-page__filter">
              <span>{t('usersPage.filterCategory')}</span>
              <select
                value={query.category ?? ''}
                onChange={(e) =>
                  updateQuery({ category: (e.target.value || undefined) as AdminCustomersQuery['category'] })
                }
              >
                <option value="">{t('usersPage.all')}</option>
                <option value="bronze">{t('usersPage.category.bronze')}</option>
                <option value="silver">{t('usersPage.category.silver')}</option>
                <option value="gold">{t('usersPage.category.gold')}</option>
              </select>
            </label>
            <label className="users-page__filter">
              <span>{t('usersPage.sortBy')}</span>
              <select
                value={query.sort ?? 'newest'}
                onChange={(e) => updateQuery({ sort: e.target.value as AdminCustomersQuery['sort'] })}
              >
                <option value="newest">{t('usersPage.sortNewest')}</option>
                <option value="oldest">{t('usersPage.sortOldest')}</option>
                <option value="name">{t('usersPage.sortName')}</option>
                <option value="last_active">{t('usersPage.sortLastActive')}</option>
              </select>
            </label>
          </div>
        </div>

        {loading && !data ? (
          <LoadingBlock />
        ) : !data || data.users.length === 0 ? (
          <EmptyState title={t('usersPage.empty')} />
        ) : (
          <div className="users-page__table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('usersPage.colUser')}</th>
                  <th>{t('usersPage.colPhone')}</th>
                  <th>{t('usersPage.colCategory')}</th>
                  <th>{t('usersPage.colTickets')}</th>
                  <th>{t('usersPage.colSpent')}</th>
                  <th>{t('usersPage.colStatus')}</th>
                  <th>{t('usersPage.colJoined')}</th>
                  <th>{t('usersPage.colLastActive')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => {
                  const deleted = user.account_status === 'deleted';
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="users-page__identity">
                          <span className="users-page__avatar" aria-hidden="true">
                            {user.profile_photo_url ? (
                              <img src={user.profile_photo_url} alt="" />
                            ) : (
                              user.full_name.trim().charAt(0).toUpperCase()
                            )}
                          </span>
                          <span>
                            <span className="cell-strong">{user.full_name}</span>
                            <span className="muted users-page__sub">{user.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>{user.phone}</td>
                      <td>{t(`usersPage.category.${user.category}`)}</td>
                      <td>{user.tickets_bought}</td>
                      <td>{formatMoney(user.total_spent + user.drinks_spent)}</td>
                      <td>
                        <StatusPill
                          label={t(`usersPage.status.${user.account_status}`)}
                          tone={statusTone(user.account_status)}
                        />
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>{formatDate(user.last_active_at)}</td>
                      <td className="cell-actions users-page__actions">
                        <button
                          type="button"
                          className="ghost-btn ghost-btn--sm"
                          onClick={() => setModal({ kind: 'view', userId: user.id })}
                            title={t('usersPage.view')}
                            aria-label={t('usersPage.view')}
                        >
                          <IconEye />
                        </button>
                        {!deleted ? (
                          <>
                            <button
                              type="button"
                              className="ghost-btn ghost-btn--sm"
                              onClick={() => setModal({ kind: 'edit', user })}
                                title={t('usersPage.edit')}
                                aria-label={t('usersPage.edit')}
                            >
                              <IconEdit />
                            </button>
                            {user.account_status === 'blocked' ? (
                              <button
                                type="button"
                                className="ghost-btn ghost-btn--sm"
                                title={t('usersPage.unblock')}
                                aria-label={t('usersPage.unblock')}
                                onClick={() => void unblock(user)}
                              >
                                <IconUndo />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghost-btn ghost-btn--sm"
                                onClick={() => setModal({ kind: 'block', user })}
                                  title={t('usersPage.block')}
                                  aria-label={t('usersPage.block')}
                              >
                                <IconBan />
                              </button>
                            )}
                            <button
                              type="button"
                              className="ghost-btn ghost-btn--sm ghost-btn--danger"
                              onClick={() => setModal({ kind: 'delete', user })}
                                title={t('usersPage.delete')}
                                aria-label={t('usersPage.delete')}
                            >
                              <IconTrash />
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 ? (
          <div className="users-page__pagination">
            <span className="muted">
              {t('usersPage.showing', { from: String(from), to: String(to), total: String(pagination.total) })}
            </span>
            <div className="table-card__tools">
              <button
                type="button"
                className="ghost-btn ghost-btn--sm"
                disabled={pagination.page <= 1}
                onClick={() => updateQuery({ page: pagination.page - 1 })}
              >
                {t('usersPage.previous')}
              </button>
              <button
                type="button"
                className="ghost-btn ghost-btn--sm"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => updateQuery({ page: pagination.page + 1 })}
              >
                {t('usersPage.next')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {modal.kind === 'view' ? (
        <UserDetailModal
          userId={modal.userId}
          onClose={() => setModal({ kind: 'none' })}
          formatMoney={formatMoney}
          formatDate={formatDate}
        />
      ) : null}
      {modal.kind === 'edit' ? (
        <EditUserModal
          user={modal.user}
          onClose={() => setModal({ kind: 'none' })}
          onSaved={() => void afterAction(t('usersPage.editSaved'))}
        />
      ) : null}
      {modal.kind === 'block' ? (
        <BlockUserModal
          user={modal.user}
          onClose={() => setModal({ kind: 'none' })}
          onDone={() => void afterAction(t('usersPage.blockedDone'))}
        />
      ) : null}
      {modal.kind === 'delete' ? (
        <DeleteUserModal
          user={modal.user}
          onClose={() => setModal({ kind: 'none' })}
          onDone={() => void afterAction(t('usersPage.deletedDone'))}
        />
      ) : null}
    </section>
  );
}

function UserDetailModal({
  userId,
  onClose,
  formatMoney,
  formatDate,
}: {
  userId: string;
  onClose: () => void;
  formatMoney: (value: number) => string;
  formatDate: (iso: string | null, withTime?: boolean) => string;
}) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void adminApi.customer(userId).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setError(result.error ?? t('usersPage.loadError'));
        return;
      }
      setDetail(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  const user = detail?.user;

  return (
    <Modal
      open
      onClose={onClose}
      title={user?.full_name ?? t('usersPage.detailTitle')}
      subtitle={user ? `${user.phone} · ${user.email}` : undefined}
      closeLabel={t('usersPage.close')}
      contentClassName="modal__panel users-page__modal users-page__modal--wide"
      error={error}
    >
      {!detail || !user ? (
        <LoadingBlock />
      ) : (
        <div className="users-page__detail">
          {user.account_status === 'blocked' ? (
            <Alert tone="error">
              {t('usersPage.blockedSince', { date: formatDate(user.blocked_at, true) })}
              {user.blocked_reason ? ` · ${t('usersPage.blockedReasonLabel', { reason: user.blocked_reason })}` : ''}
            </Alert>
          ) : null}
          {user.account_status === 'pending_deletion' ? (
            <Alert tone="warning">
              {t('usersPage.deletionScheduled', { date: formatDate(user.deletion_scheduled_at, true) })}
            </Alert>
          ) : null}

          <h4>{t('usersPage.sectionProfile')}</h4>
          <dl className="users-page__facts">
            <dt>{t('usersPage.colStatus')}</dt>
            <dd>
              <StatusPill label={t(`usersPage.status.${user.account_status}`)} tone={statusTone(user.account_status)} />
            </dd>
            <dt>{t('usersPage.fieldRut')}</dt>
            <dd>{user.rut_or_passport}</dd>
            <dt>{t('usersPage.fieldBirthdate')}</dt>
            <dd>{user.birthdate}</dd>
            <dt>{t('usersPage.fieldGender')}</dt>
            <dd>{t(`usersPage.gender.${user.gender}`)}</dd>
            <dt>{t('usersPage.fieldInstagram')}</dt>
            <dd>{user.instagram_username ? `@${user.instagram_username}` : '—'}</dd>
            <dt>{t('usersPage.fieldCategory')}</dt>
            <dd>{t(`usersPage.category.${user.category}`)}</dd>
            <dt>{t('usersPage.fieldCountry')}</dt>
            <dd>{user.country_code}</dd>
            <dt>{t('usersPage.fieldJoined')}</dt>
            <dd>{formatDate(user.created_at, true)}</dd>
          </dl>

          <h4>{t('usersPage.sectionActivity')}</h4>
          <dl className="users-page__facts">
            <dt>{t('usersPage.fieldTicketsBought')}</dt>
            <dd>{user.tickets_bought}</dd>
            <dt>{t('usersPage.fieldTotalSpent')}</dt>
            <dd>{formatMoney(user.total_spent)}</dd>
            <dt>{t('usersPage.fieldDrinksSpent')}</dt>
            <dd>{formatMoney(user.drinks_spent)}</dd>
            <dt>{t('usersPage.fieldFavorites')}</dt>
            <dd>{detail.favorites_count}</dd>
            <dt>{t('usersPage.fieldSessions')}</dt>
            <dd>{detail.active_sessions}</dd>
            <dt>{t('usersPage.colLastActive')}</dt>
            <dd>{formatDate(user.last_active_at, true)}</dd>
          </dl>

          <h4>{t('usersPage.sectionOrders')}</h4>
          {detail.ticket_orders.length === 0 ? (
            <p className="muted">{t('usersPage.noRows')}</p>
          ) : (
            <table className="data-table">
              <tbody>
                {detail.ticket_orders.map((order) => (
                  <tr key={order.id}>
                    <td className="cell-strong">{order.event_title}</td>
                    <td>×{order.quantity}</td>
                    <td>{formatMoney(order.total_amount)}</td>
                    <td>
                      <StatusPill label={order.status} tone={order.status === 'paid' ? 'success' : 'neutral'} />
                    </td>
                    <td className="muted">{formatDate(order.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>{t('usersPage.sectionInvitations')}</h4>
          {detail.invitations.length === 0 ? (
            <p className="muted">{t('usersPage.noRows')}</p>
          ) : (
            <table className="data-table">
              <tbody>
                {detail.invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="cell-strong">{invitation.event_title}</td>
                    <td>{invitation.source}</td>
                    <td>{invitation.tier}</td>
                    <td>
                      <StatusPill
                        label={invitation.status}
                        tone={invitation.status === 'accepted' ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="muted">{formatDate(invitation.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>{t('usersPage.sectionDrinks')}</h4>
          {detail.drink_orders.length === 0 ? (
            <p className="muted">{t('usersPage.noRows')}</p>
          ) : (
            <table className="data-table">
              <tbody>
                {detail.drink_orders.map((order) => (
                  <tr key={order.id}>
                    <td className="cell-strong">{order.event_title}</td>
                    <td>{formatMoney(order.total_clp)}</td>
                    <td>
                      <StatusPill label={order.status} />
                    </td>
                    <td className="muted">{formatDate(order.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>{t('usersPage.sectionCards')}</h4>
          {detail.payment_methods.length === 0 ? (
            <p className="muted">{t('usersPage.noRows')}</p>
          ) : (
            <ul className="users-page__cards">
              {detail.payment_methods.map((card) => (
                <li key={card.id}>
                  {card.brand} •••• {card.last_four}
                  {card.is_default ? <StatusPill label="Default" tone="success" /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminCustomer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    country_code: user.country_code,
    rut_or_passport: user.rut_or_passport,
    birthdate: user.birthdate,
    gender: user.gender,
    instagram_username: user.instagram_username ?? '',
    category: user.category,
    preferred_language: user.preferred_language ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    // Only send fields that changed.
    const body: AdminCustomerUpdate = {};
    if (form.full_name.trim() !== user.full_name) body.full_name = form.full_name.trim();
    if (form.email.trim() !== user.email) body.email = form.email.trim();
    if (form.phone.trim() !== user.phone || form.country_code !== user.country_code) {
      body.phone = form.phone.trim();
      body.country_code = form.country_code.trim().toUpperCase();
    }
    if (form.rut_or_passport.trim() !== user.rut_or_passport) body.rut_or_passport = form.rut_or_passport.trim();
    if (form.birthdate !== user.birthdate) body.birthdate = form.birthdate;
    if (form.gender !== user.gender) body.gender = form.gender;
    if (form.instagram_username.trim() !== (user.instagram_username ?? '')) {
      body.instagram_username = form.instagram_username.trim() || null;
    }
    if (form.category !== user.category) body.category = form.category;
    if (form.preferred_language !== (user.preferred_language ?? '')) {
      body.preferred_language = (form.preferred_language || null) as AdminCustomerUpdate['preferred_language'];
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    const result = await adminApi.updateCustomer(user.id, body);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? t('usersPage.loadError'));
      return;
    }
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('usersPage.editTitle')}
      subtitle={user.full_name}
      closeLabel={t('usersPage.close')}
      contentClassName="modal__panel users-page__modal"
      error={error}
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t('usersPage.cancel')}
          </button>
          <button type="button" className="primary-btn" disabled={saving} onClick={() => void onSubmit()}>
            {saving ? t('usersPage.saving') : t('usersPage.save')}
          </button>
        </>
      }
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field form-grid__full">
          <span className="field__label">{t('usersPage.fieldName')}</span>
          <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldEmail')}</span>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldRut')}</span>
          <input value={form.rut_or_passport} onChange={(e) => update('rut_or_passport', e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldPhone')}</span>
          <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldCountry')}</span>
          <input value={form.country_code} maxLength={5} onChange={(e) => update('country_code', e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldBirthdate')}</span>
          <input type="date" value={form.birthdate} onChange={(e) => update('birthdate', e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldGender')}</span>
          <select value={form.gender} onChange={(e) => update('gender', e.target.value as AdminCustomer['gender'])}>
            {(['male', 'female', 'other', 'prefer_not_to_say'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`usersPage.gender.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldInstagram')}</span>
          <input
            value={form.instagram_username}
            placeholder="@username"
            onChange={(e) => update('instagram_username', e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldCategory')}</span>
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value as AdminCustomer['category'])}
          >
            {(['bronze', 'silver', 'gold'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`usersPage.category.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t('usersPage.fieldLanguage')}</span>
          <select value={form.preferred_language} onChange={(e) => update('preferred_language', e.target.value)}>
            <option value="">—</option>
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
        </label>
      </form>
    </Modal>
  );
}

function BlockUserModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminCustomer;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    const result = await adminApi.blockCustomer(user.id, reason.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? t('usersPage.loadError'));
      return;
    }
    onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('usersPage.blockTitle')}
      subtitle={user.full_name}
      closeLabel={t('usersPage.close')}
      contentClassName="modal__panel users-page__modal"
      error={error}
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t('usersPage.cancel')}
          </button>
          <button type="button" className="primary-btn" disabled={busy} onClick={() => void confirm()}>
            {t('usersPage.blockConfirm')}
          </button>
        </>
      }
    >
      <p className="muted">{t('usersPage.blockDescription')}</p>
      <label className="field">
        <span className="field__label">{t('usersPage.blockReason')}</span>
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Modal>
  );
}

function DeleteUserModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminCustomer;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    const result = await adminApi.deleteCustomer(user.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? t('usersPage.loadError'));
      return;
    }
    onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('usersPage.deleteTitle')}
      subtitle={`${user.full_name} · ${user.phone}`}
      closeLabel={t('usersPage.close')}
      contentClassName="modal__panel users-page__modal"
      error={error}
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t('usersPage.cancel')}
          </button>
          <button
            type="button"
            className="primary-btn users-page__danger-btn"
            disabled={busy || typed !== 'DELETE'}
            onClick={() => void confirm()}
          >
            {t('usersPage.deleteConfirm')}
          </button>
        </>
      }
    >
      <Alert tone="error">{t('usersPage.deleteDescription')}</Alert>
      <label className="field">
        <span className="field__label">{t('usersPage.deleteTypeToConfirm')}</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" />
      </label>
    </Modal>
  );
}
