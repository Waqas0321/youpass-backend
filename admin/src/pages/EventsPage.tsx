import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminApi,
  AdminEvent,
  AdminEventInput,
  CountryOption,
  EventTypeOption,
  PhysicalVenue,
  Producer,
} from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EventPurchaseConfigPanel } from '../components/EventPurchaseConfigPanel';
import { EventVenueFields } from '../components/EventVenueFields';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusPill } from '../components/ui/StatusPill';

const EMPTY_FORM: AdminEventInput = {
  title: '',
  description: '',
  starts_at: '',
  venue_name: '',
  city: '',
  country_code: 'CL',
  image_url: '',
  event_type: 'parties',
  producer_name: '',
  latitude: undefined,
  longitude: undefined,
  status: 'draft',
  is_featured: false,
  featured_order: 0,
};

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function statusTone(status: AdminEvent['status']) {
  if (status === 'published') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const;
}

export function EventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [venues, setVenues] = useState<PhysicalVenue[]>([]);
  const [linkedVenueHint, setLinkedVenueHint] = useState<PhysicalVenue | null>(null);
  const [categories, setCategories] = useState<EventTypeOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [form, setForm] = useState<AdminEventInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const publishedCount = useMemo(
    () => events.filter((event) => event.status === 'published').length,
    [events],
  );

  async function load() {
    const [eventsResult, typesResult, countriesResult, producersResult, venuesResult] =
      await Promise.all([
      adminApi.events(),
      adminApi.eventTypes(),
      adminApi.countries(),
      adminApi.producers(),
      adminApi.venues(),
    ]);

    setLoading(false);

    if (!eventsResult.ok) {
      setError(eventsResult.error ?? 'Failed to load events');
      return;
    }

    setEvents(eventsResult.data?.events ?? []);
    setCategories(typesResult.ok ? (typesResult.data ?? []) : []);
    setCountries(countriesResult.ok ? (countriesResult.data ?? []) : []);
    setProducers(producersResult.data?.producers ?? []);
    setVenues(venuesResult.ok ? (venuesResult.data?.venues ?? []) : []);
    setError('');
  }

  useEffect(() => {
    void load();
  }, []);

  function updateForm<K extends keyof AdminEventInput>(key: K, value: AdminEventInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setLinkedVenueHint(null);
    setMessage('');
    setError('');
  }

  function startEdit(event: AdminEvent) {
    setEditingId(event.id);
    setMessage('');
    setError('');
    setLinkedVenueHint(event.physical_venue ?? null);
    setForm({
      title: event.title,
      description: event.description ?? '',
      starts_at: toDatetimeLocalValue(event.starts_at),
      venue_id: event.venue_id ?? undefined,
      venue_name: event.venue_name ?? '',
      city: event.city,
      country_code: event.country_code ?? 'CL',
      image_url: event.image_url ?? '',
      event_type: event.event_type?.slug ?? 'parties',
      producer_name: event.producer_name ?? '',
      latitude: event.latitude ?? undefined,
      longitude: event.longitude ?? undefined,
      status: event.status ?? 'draft',
      is_featured: event.is_featured ?? false,
      featured_order: event.featured_order ?? 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => {
      document.getElementById('events-editor')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function startEditTickets(event: AdminEvent) {
    startEdit(event);
    requestAnimationFrame(() => {
      document.getElementById('event-purchase-config')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  async function onSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload: AdminEventInput = {
      ...form,
      title: form.title.trim(),
      venue_name: form.venue_name?.trim(),
      city: form.city?.trim(),
      country_code: form.country_code?.toUpperCase(),
      venue_id: form.venue_id || undefined,
      description: form.description?.trim() || undefined,
      image_url: form.image_url?.trim() || undefined,
      producer_name: form.producer_name?.trim() || undefined,
      starts_at: new Date(form.starts_at).toISOString(),
      latitude:
        form.latitude === undefined || Number.isNaN(Number(form.latitude))
          ? undefined
          : Number(form.latitude),
      longitude:
        form.longitude === undefined || Number.isNaN(Number(form.longitude))
          ? undefined
          : Number(form.longitude),
    };

    const result = editingId
      ? await adminApi.updateEvent(editingId, payload)
      : await adminApi.createEvent(payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }

    const savedEvent = result.data;
    if (editingId) {
      setMessage('Event updated. Ticket settings are below — use the section nav to jump between General, VIP General, and zones.');
      await load();
      if (savedEvent) {
        startEdit(savedEvent);
      }
      return;
    }

    setMessage('Event created. Configure tickets in the sections below, then Publish when ready.');
    await load();
    if (savedEvent) {
      startEdit(savedEvent);
      requestAnimationFrame(() => {
        document.getElementById('event-purchase-config')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  async function togglePublish(event: AdminEvent) {
    const nextStatus = event.status === 'published' ? 'draft' : 'published';
    const result = await adminApi.updateEvent(event.id, { status: nextStatus });
    if (!result.ok) {
      setError(result.error ?? 'Status update failed');
      return;
    }
    setMessage(nextStatus === 'published' ? 'Event published to the app.' : 'Event moved to draft.');
    await load();
  }

  async function removeEvent(event: AdminEvent) {
    const confirmed = window.confirm(`Delete "${event.title}"? This cannot be undone.`);
    if (!confirmed) return;

    const result = await adminApi.deleteEvent(event.id);
    if (!result.ok) {
      setError(result.error ?? 'Delete failed');
      return;
    }
    if (editingId === event.id) {
      resetForm();
    }
    setMessage('Event deleted.');
    await load();
  }

  if (loading) {
    return <LoadingBlock label="Loading events…" />;
  }

  return (
    <section className="page">
      <PageHeader
        title="Events"
        subtitle="Create events for the app. Click Tickets to configure General waves, VIP General, zones, and tables."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="table-card">
        <div className="table-card__header">
          <h3>All events</h3>
          <span className="muted">
            {publishedCount} published / {events.length} total
          </span>
        </div>
        {events.length === 0 ? (
          <EmptyState
            title="No events yet"
            description="Create your first event using the form below."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>When</th>
                <th>Promoter</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className={editingId === event.id ? 'data-table__row--active' : ''}>
                  <td>
                    <div className="row-title">
                      {event.image_url ? <img src={event.image_url} alt="" /> : null}
                      <div>
                        <strong>{event.title}</strong>
                        <p className="muted">
                          {event.location_display ?? `${event.venue_name ?? ''}, ${event.city}`}
                        </p>
                        {event.event_type ? (
                          <p className="muted">
                            {event.event_type.icon ? `${event.event_type.icon} ` : ''}
                            {event.event_type.name}
                            {event.is_featured ? ' · Featured' : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>{formatEventDate(event.starts_at)}</td>
                  <td>{event.producer_name ?? '—'}</td>
                  <td>
                    <StatusPill
                      label={event.status ?? 'draft'}
                      tone={statusTone(event.status)}
                    />
                  </td>
                  <td className="cell-actions">
                    <button className="ghost-btn ghost-btn--sm" onClick={() => startEdit(event)}>
                      Edit
                    </button>
                    <button
                      className="ghost-btn ghost-btn--sm"
                      onClick={() => startEditTickets(event)}
                    >
                      Tickets
                    </button>
                    <button className="ghost-btn ghost-btn--sm" onClick={() => togglePublish(event)}>
                      {event.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      className="ghost-btn ghost-btn--sm ghost-btn--danger"
                      onClick={() => removeEvent(event)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingId ? (
        <div className="events-editor" id="events-editor">
          <div className="events-editor__banner">
            <div>
              <strong>Editing: {form.title || 'Event'}</strong>
              <p className="muted">
                Update event details, then configure tickets in the sections below.
              </p>
            </div>
            <button className="ghost-btn" type="button" onClick={resetForm}>
              Close editor
            </button>
          </div>

          <Panel
            title="Event details"
            description="Set status to Published when the event should appear in the app."
          >
        <form className="form-grid form-grid--3" onSubmit={onSubmit}>
          <label className="field">
            <span className="field__label">Title</span>
            <input
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="YouFest 2026"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Date & time</span>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => updateForm('starts_at', e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                updateForm('status', e.target.value as AdminEventInput['status'])
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <EventVenueFields
            value={{
              venue_id: form.venue_id,
              venue_name: form.venue_name ?? '',
              city: form.city ?? '',
              country_code: form.country_code ?? 'CL',
            }}
            venues={venues}
            countries={countries}
            linkedVenueHint={linkedVenueHint}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          />

          <label className="field">
            <span className="field__label">Category</span>
            <select
              value={form.event_type}
              onChange={(e) => updateForm('event_type', e.target.value)}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Promoter</span>
            <select
              value={form.producer_name ?? ''}
              onChange={(e) => updateForm('producer_name', e.target.value)}
            >
              <option value="">No promoter</option>
              {producers.map((producer) => (
                <option key={producer.id} value={producer.name}>
                  {producer.name}
                </option>
              ))}
            </select>
            <span className="field__hint">
              Add or edit promoters in <Link to="/producers">Producers</Link>.
            </span>
          </label>

          <label className="field">
            <span className="field__label">Featured order</span>
            <input
              type="number"
              min={0}
              value={form.featured_order ?? 0}
              onChange={(e) => updateForm('featured_order', Number(e.target.value))}
            />
          </label>

          <label className="field form-grid__full">
            <span className="field__label">Image URL</span>
            <input
              value={form.image_url ?? ''}
              onChange={(e) => updateForm('image_url', e.target.value)}
              placeholder="https://images.unsplash.com/..."
            />
          </label>

          <label className="field form-grid__full">
            <span className="field__label">Description</span>
            <textarea
              rows={4}
              value={form.description ?? ''}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="About the event — shown on the event detail screen."
            />
          </label>

          <label className="field">
            <span className="field__label">Latitude</span>
            <input
              type="number"
              step="any"
              value={form.latitude ?? ''}
              onChange={(e) =>
                updateForm('latitude', e.target.value === '' ? undefined : Number(e.target.value))
              }
              placeholder="-33.4489"
            />
          </label>

          <label className="field">
            <span className="field__label">Longitude</span>
            <input
              type="number"
              step="any"
              value={form.longitude ?? ''}
              onChange={(e) =>
                updateForm('longitude', e.target.value === '' ? undefined : Number(e.target.value))
              }
              placeholder="-70.6693"
            />
          </label>

          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={form.is_featured ?? false}
              onChange={(e) => updateForm('is_featured', e.target.checked)}
            />
            <span>Featured on home carousel</span>
          </label>

          <div className="form-actions form-grid__full">
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save event details'}
            </button>
          </div>
        </form>
      </Panel>

          <div id="event-purchase-config">
            <EventPurchaseConfigPanel
              eventId={editingId}
              eventTitle={form.title || 'Event'}
              venueName={form.venue_name}
            />
          </div>
        </div>
      ) : (
        <Panel
          title="Add event"
          description="Create a new event, then configure General tickets, VIP General, and VIP zones."
        >
          <form className="form-grid form-grid--3" onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Title</span>
              <input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="YouFest 2026"
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Date & time</span>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => updateForm('starts_at', e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Status</span>
              <select
                value={form.status}
                onChange={(e) =>
                  updateForm('status', e.target.value as AdminEventInput['status'])
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <EventVenueFields
              value={{
                venue_id: form.venue_id,
                venue_name: form.venue_name ?? '',
                city: form.city ?? '',
                country_code: form.country_code ?? 'CL',
              }}
              venues={venues}
              countries={countries}
              onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            />

            <label className="field">
              <span className="field__label">Category</span>
              <select
                value={form.event_type}
                onChange={(e) => updateForm('event_type', e.target.value)}
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.icon ? `${category.icon} ` : ''}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Promoter</span>
              <select
                value={form.producer_name ?? ''}
                onChange={(e) => updateForm('producer_name', e.target.value)}
              >
                <option value="">No promoter</option>
                {producers.map((producer) => (
                  <option key={producer.id} value={producer.name}>
                    {producer.name}
                  </option>
                ))}
              </select>
              <span className="field__hint">
                Add or edit promoters in <Link to="/producers">Producers</Link>.
              </span>
            </label>

            <label className="field">
              <span className="field__label">Featured order</span>
              <input
                type="number"
                min={0}
                value={form.featured_order ?? 0}
                onChange={(e) => updateForm('featured_order', Number(e.target.value))}
              />
            </label>

            <label className="field form-grid__full">
              <span className="field__label">Image URL</span>
              <input
                value={form.image_url ?? ''}
                onChange={(e) => updateForm('image_url', e.target.value)}
                placeholder="https://images.unsplash.com/..."
              />
            </label>

            <label className="field form-grid__full">
              <span className="field__label">Description</span>
              <textarea
                rows={4}
                value={form.description ?? ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="About the event — shown on the event detail screen."
              />
            </label>

            <label className="field">
              <span className="field__label">Latitude</span>
              <input
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={(e) =>
                  updateForm('latitude', e.target.value === '' ? undefined : Number(e.target.value))
                }
                placeholder="-33.4489"
              />
            </label>

            <label className="field">
              <span className="field__label">Longitude</span>
              <input
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={(e) =>
                  updateForm('longitude', e.target.value === '' ? undefined : Number(e.target.value))
                }
                placeholder="-70.6693"
              />
            </label>

            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={form.is_featured ?? false}
                onChange={(e) => updateForm('is_featured', e.target.checked)}
              />
              <span>Featured on home carousel</span>
            </label>

            <div className="form-actions form-grid__full">
              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create event'}
              </button>
            </div>
          </form>
        </Panel>
      )}
    </section>
  );
}
