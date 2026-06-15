import { FormEvent, useEffect, useState } from 'react';
import { adminApi, AdminEvent, EventInvitationSettings } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';

const DISCOUNT_OPTIONS = [10, 25, 50, 75];

export function EventSettingsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [settings, setSettings] = useState<EventInvitationSettings | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

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
    adminApi.eventInvitationSettings(eventId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? 'Failed to load settings');
        return;
      }
      setSettings(result.data ?? null);
      setError('');
    });
  }, [eventId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!eventId || !settings) return;
    setError('');
    setMessage('');
    const result = await adminApi.updateEventInvitationSettings(eventId, settings);
    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }
    setSettings(result.data ?? settings);
    setMessage('Invitation settings saved.');
  }

  function update<K extends keyof EventInvitationSettings>(key: K, value: EventInvitationSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  return (
    <section className="page">
      <PageHeader
        title="Event invitation settings"
        subtitle="Per-event configuration for Free, Guaranteed Pass, and Discounted invitation types (Section 14.7)."
        actions={
          <div className="select-field producer-select">
            <label htmlFor="event-select">Event</label>
            <select id="event-select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
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
      {message ? <Alert tone="success">{message}</Alert> : null}

      {loading || !settings ? (
        <p className="muted">Loading settings…</p>
      ) : (
        <Panel title="Invitation types" description="Toggle which invitation types promoters can send for this event.">
          <form onSubmit={onSubmit}>
            <div className="form-grid form-grid--3">
              <label className="field">
                <span className="field__label">Allow Free</span>
                <select
                  value={settings.allow_free ? 'yes' : 'no'}
                  onChange={(e) => update('allow_free', e.target.value === 'yes')}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Allow Guaranteed Pass</span>
                <select
                  value={settings.allow_guaranteed ? 'yes' : 'no'}
                  onChange={(e) => update('allow_guaranteed', e.target.value === 'yes')}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Allow Discounted</span>
                <select
                  value={settings.allow_discount ? 'yes' : 'no'}
                  onChange={(e) => update('allow_discount', e.target.value === 'yes')}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </label>
            </div>

            <div className="form-grid form-grid--3 form-stack">
              <label className="field">
                <span className="field__label">Free cancellation (days before event)</span>
                <input
                  type="number"
                  value={settings.free_cancellation_days}
                  onChange={(e) => update('free_cancellation_days', Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span className="field__label">Guaranteed cancellation days</span>
                <input
                  type="number"
                  value={settings.guaranteed_cancellation_days}
                  onChange={(e) => update('guaranteed_cancellation_days', Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span className="field__label">Discount cancellation days</span>
                <input
                  type="number"
                  value={settings.discount_cancellation_days}
                  onChange={(e) => update('discount_cancellation_days', Number(e.target.value))}
                />
              </label>
            </div>

            <label className="field form-stack">
              <span className="field__label">Default discount % (Type 3)</span>
              <select
                value={settings.discount_percentage ?? ''}
                onChange={(e) =>
                  update('discount_percentage', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Not set</option>
                {DISCOUNT_OPTIONS.map((pct) => (
                  <option key={pct} value={pct}>
                    {pct}%
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid form-grid--3 form-stack">
              <label className="field">
                <span className="field__label">Enable waiting list</span>
                <select
                  value={settings.enable_waiting_list ? 'yes' : 'no'}
                  onChange={(e) => update('enable_waiting_list', e.target.value === 'yes')}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Enable manual re-invitation</span>
                <select
                  value={settings.enable_manual_reinvitation ? 'yes' : 'no'}
                  onChange={(e) =>
                    update('enable_manual_reinvitation', e.target.value === 'yes')
                  }
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Offer window (hours)</span>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={settings.waitlist_offer_hours ?? 4}
                  onChange={(e) => update('waitlist_offer_hours', Number(e.target.value))}
                />
              </label>
            </div>
            <label className="field form-stack">
              <span className="field__label">Courtesy slots total (0 = auto from invitations)</span>
              <input
                type="number"
                min={0}
                value={settings.courtesy_slots_total ?? 0}
                onChange={(e) => update('courtesy_slots_total', Number(e.target.value))}
              />
            </label>

            <div className="form-actions">
              <button className="primary-btn" type="submit">
                Save settings
              </button>
            </div>
          </form>
        </Panel>
      )}
    </section>
  );
}
