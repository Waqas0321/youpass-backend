import { FormEvent, useEffect, useState } from 'react';
import {
  adminApi,
  AdminEvent,
  AdminUser,
  CreateInvitationBody,
  Producer,
  ProducerInvitation,
  ProducerInvitationStats,
  getSession,
  saveSession,
} from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusPill } from '../components/ui/StatusPill';

function invitationTone(state: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (state === 'accepted' || state === 'confirmed') return 'success';
  if (state === 'pending' || state === 'sent') return 'warning';
  if (state === 'expired' || state === 'rejected' || state === 'cancelled') return 'danger';
  return 'neutral';
}

export function InvitationsPage() {
  const session = getSession();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [producerId, setProducerId] = useState(session?.producerId ?? '');
  const [stats, setStats] = useState<ProducerInvitationStats | null>(null);
  const [invitations, setInvitations] = useState<ProducerInvitation[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateInvitationBody>({
    event_id: '',
    type: 'guaranteed',
    recipient_user_id: '',
    slot_label: 'VIP Table 1',
    cancellation_deadline_days: 3,
    personalised_message: '',
  });

  useEffect(() => {
    Promise.all([adminApi.producers(), adminApi.events(), adminApi.users()]).then(
      ([producerResult, eventResult, usersResult]) => {
      if (producerResult.ok) {
        const list = producerResult.data?.producers ?? [];
        setProducers(list);
        if (!producerId && list[0]) {
          setProducerId(list[0].id);
        }
      }
      if (eventResult.ok) {
        const list = eventResult.data?.events ?? [];
        setEvents(list);
        if (!form.event_id && list[0]) {
          setForm((current) => ({ ...current, event_id: list[0].id }));
        }
      }
      if (usersResult.ok) {
        const list = usersResult.data?.users ?? [];
        setUsers(list);
        if (!form.recipient_user_id && list[0]) {
          setForm((current) => ({ ...current, recipient_user_id: list[0].id }));
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!producerId) {
      return;
    }
    saveSession({ apiKey: session?.apiKey ?? '', producerId });
    Promise.all([
      adminApi.producerStats(producerId),
      adminApi.producerInvitations(producerId),
    ]).then(([statsResult, listResult]) => {
      if (statsResult.ok) {
        setStats(statsResult.data ?? null);
      }
      if (listResult.ok) {
        setInvitations(listResult.data?.invitations ?? []);
      }
    });
  }, [producerId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!producerId) {
      return;
    }
    setError('');
    setMessage('');
    const result = await adminApi.createInvitation(producerId, form);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create invitation');
      return;
    }
    setMessage('Invitation sent successfully.');
    const refreshed = await adminApi.producerInvitations(producerId);
    if (refreshed.ok) {
      setInvitations(refreshed.data?.invitations ?? []);
    }
    const statsRefresh = await adminApi.producerStats(producerId);
    if (statsRefresh.ok) {
      setStats(statsRefresh.data ?? null);
    }
  }

  const producerSelect = (
    <div className="select-field producer-select">
      <label htmlFor="producer-select">Producer</label>
      <select
        id="producer-select"
        value={producerId}
        onChange={(e) => setProducerId(e.target.value)}
      >
        {producers.map((producer) => (
          <option key={producer.id} value={producer.id}>
            {producer.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="page">
      <PageHeader
        title="Producer invitations"
        subtitle="Send and monitor Guaranteed Pass, Free, and Discounted invitations."
        actions={producerSelect}
      />

      {stats ? (
        <div className="stat-grid">
          <StatCard label="Sent" value={stats.total_sent} />
          <StatCard label="Accepted" value={stats.accepted_count} tone="green" />
          <StatCard label="Pending" value={stats.pending_count} tone="gold" hint="Awaiting response" />
          <StatCard label="Charged" value={stats.charged_count} tone="purple" />
        </div>
      ) : null}

      <Panel title="Send invitation" description="Creates a new invitation and notifies the selected user.">
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Event</span>
              <select
                value={form.event_id}
                onChange={(e) => setForm({ ...form, event_id: e.target.value })}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} — {event.city}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Type</span>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CreateInvitationBody['type'] })
                }
              >
                <option value="free">Free</option>
                <option value="guaranteed">Guaranteed Pass</option>
                <option value="discounted">Discounted</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Recipient</span>
              <select
                value={form.recipient_user_id}
                onChange={(e) => setForm({ ...form, recipient_user_id: e.target.value })}
              >
                {users.length === 0 ? (
                  <option value="">No active users</option>
                ) : (
                  users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} — {user.phone}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Slot label</span>
              <input
                value={form.slot_label}
                onChange={(e) => setForm({ ...form, slot_label: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">Cancellation deadline (days)</span>
              <input
                type="number"
                value={form.cancellation_deadline_days}
                onChange={(e) =>
                  setForm({ ...form, cancellation_deadline_days: Number(e.target.value) })
                }
              />
            </label>
            {form.type === 'discounted' ? (
              <label className="field">
                <span className="field__label">Discount %</span>
                <input
                  type="number"
                  value={form.discount_percentage ?? 25}
                  onChange={(e) =>
                    setForm({ ...form, discount_percentage: Number(e.target.value) })
                  }
                />
              </label>
            ) : null}
          </div>
          <label className="field form-stack">
            <span className="field__label">Personal message</span>
            <textarea
              value={form.personalised_message ?? ''}
              onChange={(e) => setForm({ ...form, personalised_message: e.target.value })}
            />
          </label>

          <div className="form-actions">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {message ? <Alert tone="success">{message}</Alert> : null}
            <button className="primary-btn" type="submit" disabled={!form.recipient_user_id}>
              Send invitation
            </button>
          </div>
        </form>
      </Panel>

      <div className="table-card">
        <div className="table-card__header">
          <h3>Recent invitations</h3>
          <span className="muted">{invitations.length} total</span>
        </div>
        {invitations.length === 0 ? (
          <EmptyState title="No invitations yet" description="Send your first invitation using the form above." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Guest</th>
                <th>Type</th>
                <th>Status</th>
                <th>Slot</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="cell-strong">{invitation.event_title}</td>
                  <td>{invitation.recipient_name ?? invitation.recipient_phone ?? '—'}</td>
                  <td>
                    <StatusPill label={invitation.invitation_type} tone="neutral" />
                  </td>
                  <td>
                    <StatusPill
                      label={invitation.lifecycle_state}
                      tone={invitationTone(invitation.lifecycle_state)}
                    />
                  </td>
                  <td>{invitation.slot_label ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
