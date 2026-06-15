import { FormEvent, useEffect, useState } from 'react';
import {
  adminApi,
  CountryOption,
  PhysicalVenue,
  PhysicalVenueInput,
} from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';

const EMPTY_FORM: PhysicalVenueInput = {
  name: '',
  address: '',
  city: '',
  country: 'CL',
  dimensions: { width_meters: 40, height_meters: 30 },
};

export function VenuesPage() {
  const [venues, setVenues] = useState<PhysicalVenue[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [form, setForm] = useState<PhysicalVenueInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [venuesResult, countriesResult] = await Promise.all([
      adminApi.venues({
        country: filterCountry || undefined,
        q: filterQuery.trim() || undefined,
      }),
      adminApi.countries(),
    ]);
    setLoading(false);

    if (!venuesResult.ok) {
      setError(venuesResult.error ?? 'Failed to load venues');
      return;
    }

    setVenues(venuesResult.data?.venues ?? []);
    setCountries(countriesResult.ok ? (countriesResult.data ?? []) : []);
    setError('');
  }

  useEffect(() => {
    void load();
  }, [filterCountry, filterQuery]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage('');
  }

  function startEdit(venue: PhysicalVenue) {
    setEditingId(venue.id);
    setMessage('');
    setError('');
    setForm({
      name: venue.name,
      address: venue.address,
      city: venue.city,
      country: venue.country,
      dimensions: { ...venue.dimensions },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload: PhysicalVenueInput = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.toUpperCase(),
      dimensions: {
        width_meters: Number(form.dimensions.width_meters),
        height_meters: Number(form.dimensions.height_meters),
      },
    };

    const result = editingId
      ? await adminApi.updateVenue(editingId, payload)
      : await adminApi.createVenue(payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }

    setMessage(editingId ? 'Venue updated.' : 'Venue created.');
    resetForm();
    await load();
  }

  async function removeVenue(venue: PhysicalVenue) {
    const confirmed = window.confirm(`Delete "${venue.name}"? Events linked to this venue must be updated first.`);
    if (!confirmed) return;

    const result = await adminApi.deleteVenue(venue.id);
    if (!result.ok) {
      setError(result.error ?? 'Delete failed');
      return;
    }
    if (editingId === venue.id) {
      resetForm();
    }
    setMessage('Venue deleted.');
    await load();
  }

  if (loading && venues.length === 0) {
    return <LoadingBlock label="Loading venues…" />;
  }

  return (
    <section className="page">
      <PageHeader
        title="Physical venues"
        subtitle="Reusable locations for events and VIP floor plans — e.g. Club Amanda - Main Hall."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Panel
        title={editingId ? 'Edit venue' : 'Add venue'}
        description="Dimensions are used as defaults when linking a venue to an event floor plan."
      >
        <form className="form-grid form-grid--3" onSubmit={onSubmit}>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Club Amanda - Main Hall"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">City</span>
            <input
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="Santiago"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Country</span>
            <select
              value={form.country}
              onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
              required
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag_emoji ? `${country.flag_emoji} ` : ''}
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field form-grid__full">
            <span className="field__label">Address</span>
            <input
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Av. Providencia 1234"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Width (m)</span>
            <input
              type="number"
              step="any"
              min={1}
              value={form.dimensions.width_meters}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  dimensions: { ...prev.dimensions, width_meters: Number(e.target.value) },
                }))
              }
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Height (m)</span>
            <input
              type="number"
              step="any"
              min={1}
              value={form.dimensions.height_meters}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  dimensions: { ...prev.dimensions, height_meters: Number(e.target.value) },
                }))
              }
              required
            />
          </label>

          <div className="form-actions form-grid__full">
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save venue' : 'Create venue'}
            </button>
            {editingId ? (
              <button className="ghost-btn" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <div className="table-card">
        <div className="table-card__header">
          <h3>All venues</h3>
          <span className="muted">{venues.length} total</span>
        </div>

        <div className="inline-form" style={{ marginBottom: 16 }}>
          <label className="field">
            <span className="field__label">Filter country</span>
            <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}>
              <option value="">All countries</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Search</span>
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Club Amanda"
            />
          </label>
        </div>

        {venues.length === 0 ? (
          <EmptyState title="No venues yet" description="Create your first physical venue above." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Venue</th>
                <th>Location</th>
                <th>Dimensions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id} className={editingId === venue.id ? 'data-table__row--active' : ''}>
                  <td className="cell-strong">{venue.name}</td>
                  <td>
                    <p>{venue.address}</p>
                    <p className="muted">
                      {venue.city}, {venue.country}
                    </p>
                  </td>
                  <td>
                    {venue.dimensions.width_meters}m × {venue.dimensions.height_meters}m
                  </td>
                  <td className="cell-actions">
                    <button className="ghost-btn ghost-btn--sm" onClick={() => startEdit(venue)}>
                      Edit
                    </button>
                    <button
                      className="ghost-btn ghost-btn--sm ghost-btn--danger"
                      onClick={() => void removeVenue(venue)}
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
    </section>
  );
}
