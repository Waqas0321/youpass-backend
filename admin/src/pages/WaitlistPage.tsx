import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, AdminEvent, EventWaitlistDashboard } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusPill } from '../components/ui/StatusPill';

function offerTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'claimed') return 'success';
  if (status === 'active') return 'warning';
  if (status === 'expired') return 'danger';
  return 'neutral';
}

function entryTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'offered') return 'warning';
  if (status === 'waiting') return 'neutral';
  return 'neutral';
}

export function WaitlistPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [dashboard, setDashboard] = useState<EventWaitlistDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobMessage, setJobMessage] = useState('');
  const [runningJob, setRunningJob] = useState(false);

  useEffect(() => {
    adminApi.events().then((result) => {
      if (result.ok && result.data?.events.length) {
        setEvents(result.data.events);
        setEventId(result.data.events[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    adminApi.eventWaitlist(eventId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? 'Failed to load waitlist');
        setDashboard(null);
        return;
      }
      setDashboard(result.data ?? null);
    });
  }, [eventId]);

  async function runWaitlistJob() {
    setRunningJob(true);
    setJobMessage('');
    const result = await adminApi.runSystemJob('process-waitlist-offers');
    setRunningJob(false);
    if (!result.ok) {
      setError(result.error ?? 'Job failed');
      return;
    }
    setJobMessage('Waitlist offers processed (expired offers + 1h reminders).');
    if (eventId) {
      const refresh = await adminApi.eventWaitlist(eventId);
      if (refresh.ok) {
        setDashboard(refresh.data ?? null);
      }
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Waiting list"
        subtitle="Section 14.3C — monitor courtesy slot queues, active offers, and offer history per event."
        actions={
          <div className="select-field producer-select">
            <label htmlFor="waitlist-event-select">Event</label>
            <select
              id="waitlist-event-select"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {event.city}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {jobMessage ? <Alert tone="success">{jobMessage}</Alert> : null}

      {loading || !dashboard ? (
        <p className="muted">Loading waitlist…</p>
      ) : (
        <>
          <div className="stat-grid stat-grid--4">
            <StatCard label="Waiting in queue" value={dashboard.total_waiting} />
            <StatCard
              label="Offer window"
              value={`${dashboard.settings.waitlist_offer_hours}h`}
            />
            <StatCard
              label="Courtesy slots"
              value={
                dashboard.settings.courtesy_slots_total > 0
                  ? dashboard.settings.courtesy_slots_total
                  : 'Auto'
              }
            />
            <StatCard
              label="Slots full"
              value={dashboard.settings.courtesy_slots_full ? 'Yes' : 'No'}
            />
          </div>

          <div className="form-actions" style={{ marginBottom: '1rem' }}>
            <button
              className="primary-btn"
              disabled={runningJob}
              onClick={runWaitlistJob}
            >
              {runningJob ? 'Processing…' : 'Process expired offers'}
            </button>
            <Link className="ghost-btn" to="/event-settings">
              Event settings
            </Link>
          </div>

          <div className="two-col">
            <Panel
              title="Active offer"
              description="Only one guest holds the exclusive claim window at a time."
            >
              {dashboard.active_offer ? (
                <div className="detail-list">
                  <p>
                    <strong>{dashboard.active_offer.guest_name ?? 'Guest'}</strong>
                  </p>
                  <p className="muted">{dashboard.active_offer.guest_phone}</p>
                  <p>
                    Expires: {new Date(dashboard.active_offer.expires_at).toLocaleString()}
                  </p>
                  <p>
                    Countdown: {dashboard.active_offer.expires_in_label ?? '—'}
                  </p>
                </div>
              ) : (
                <EmptyState title="No active offer" description="Queue is waiting for a released slot." />
              )}
            </Panel>

            <Panel title="Configuration" description="Per-event waiting list toggles.">
              <div className="detail-list">
                <p>
                  Waiting list:{' '}
                  <StatusPill
                    tone={dashboard.settings.enable_waiting_list ? 'success' : 'danger'}
                    label={dashboard.settings.enable_waiting_list ? 'Enabled' : 'Disabled'}
                  />
                </p>
                <p>
                  Manual re-invite:{' '}
                  <StatusPill
                    tone={dashboard.settings.enable_manual_reinvitation ? 'success' : 'neutral'}
                    label={
                      dashboard.settings.enable_manual_reinvitation ? 'Enabled' : 'Disabled'
                    }
                  />
                </p>
              </div>
            </Panel>
          </div>

          <Panel title="Queue order" description="Strictly first come, first served.">
            {dashboard.queue.length === 0 ? (
              <EmptyState title="Queue empty" description="No users are currently waiting." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Guest</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.queue.map((entry) => (
                      <tr key={entry.entry_id}>
                        <td>{entry.position}</td>
                        <td>{entry.guest_name}</td>
                        <td>{entry.guest_phone}</td>
                        <td>
                          <StatusPill tone={entryTone(entry.status)} label={entry.status} />
                        </td>
                        <td>{new Date(entry.joined_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Offer history" description="Sent, claimed, and expired slot offers.">
            {dashboard.offer_history.length === 0 ? (
              <EmptyState title="No offers yet" description="History appears when slots are released." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Offered</th>
                      <th>Expires</th>
                      <th>Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.offer_history.map((offer) => (
                      <tr key={offer.offer_id}>
                        <td>{offer.guest_name ?? '—'}</td>
                        <td>{offer.guest_phone ?? '—'}</td>
                        <td>
                          <StatusPill tone={offerTone(offer.status)} label={offer.status} />
                        </td>
                        <td>{new Date(offer.offered_at).toLocaleString()}</td>
                        <td>{new Date(offer.expires_at).toLocaleString()}</td>
                        <td>
                          {offer.claimed_at
                            ? `Claimed ${new Date(offer.claimed_at).toLocaleString()}`
                            : offer.expired_at
                              ? `Expired ${new Date(offer.expired_at).toLocaleString()}`
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </section>
  );
}
