import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, Producer, ProducerInput } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';

const EMPTY_FORM: ProducerInput = {
  name: '',
  logo_url: '',
  type_label: '',
  coverage_label: '',
  description: '',
};

const APP_FIELD_HINTS = {
  name: 'Card title in My favorites (e.g. YOUFEST)',
  type_label: 'Line under the name (e.g. Event producer)',
  coverage_label: 'Region line with calendar icon (e.g. Events across Chile)',
  logo_url: 'Square logo shown on favorites and event detail',
  description: 'Optional bio paragraph below the card metadata',
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [form, setForm] = useState<ProducerInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const result = await adminApi.producers();
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to load producers');
      return;
    }

    setProducers(result.data?.producers ?? []);
    setError('');
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage('');
  }

  function startEdit(producer: Producer) {
    setEditingId(producer.id);
    setMessage('');
    setError('');
    setForm({
      name: producer.name,
      logo_url: producer.logo_url ?? '',
      type_label: producer.type_label ?? '',
      coverage_label: producer.coverage_label ?? '',
      description: producer.description ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload: ProducerInput = {
      name: form.name.trim(),
      logo_url: form.logo_url?.trim() || null,
      type_label: form.type_label?.trim() || null,
      coverage_label: form.coverage_label?.trim() || null,
      description: form.description?.trim() || null,
    };

    const result = editingId
      ? await adminApi.updateProducer(editingId, payload)
      : await adminApi.createProducer(payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }

    setMessage(
      editingId
        ? 'Producer updated. Linked events keep the same promoter name.'
        : 'Producer created. It is now available in Events → Promoter.',
    );
    resetForm();
    await load();
  }

  const filtered = producers.filter((producer) => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      producer.name.toLowerCase().includes(query) ||
      (producer.type_label ?? '').toLowerCase().includes(query) ||
      (producer.coverage_label ?? '').toLowerCase().includes(query) ||
      (producer.description ?? '').toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <LoadingBlock label="Loading producers…" />;
  }

  return (
    <section className="page">
      <PageHeader
        title="Producers / Promoters"
        subtitle="Collect every field shown in My favorites and event detail. Events are linked separately via Events → Promoter."
        actions={
          <Link className="ghost-btn ghost-btn--sm" to="/events">
            Go to Events
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Panel
        title={editingId ? 'Edit producer' : 'Add producer'}
        description="Match the mobile card: logo, name, type, coverage, and optional bio."
      >
        <form className="producer-form" onSubmit={onSubmit}>
          <div className="producer-form__grid">
            <label className="field">
              <span className="field__label">Display name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="YOUFEST"
                required
              />
              <span className="field__hint">{APP_FIELD_HINTS.name}</span>
            </label>

            <label className="field">
              <span className="field__label">Type label</span>
              <input
                value={form.type_label ?? ''}
                onChange={(e) =>
                  setForm((current) => ({ ...current, type_label: e.target.value }))
                }
                placeholder="Event producer"
              />
              <span className="field__hint">{APP_FIELD_HINTS.type_label}</span>
            </label>

            <label className="field">
              <span className="field__label">Coverage / regions</span>
              <input
                value={form.coverage_label ?? ''}
                onChange={(e) =>
                  setForm((current) => ({ ...current, coverage_label: e.target.value }))
                }
                placeholder="Events across Chile"
              />
              <span className="field__hint">{APP_FIELD_HINTS.coverage_label}</span>
            </label>

            <label className="field">
              <span className="field__label">Logo URL</span>
              <input
                value={form.logo_url ?? ''}
                onChange={(e) => setForm((current) => ({ ...current, logo_url: e.target.value }))}
                placeholder="https://…"
                type="url"
              />
              <span className="field__hint">{APP_FIELD_HINTS.logo_url}</span>
            </label>

            <label className="field field--wide">
              <span className="field__label">Description</span>
              <textarea
                value={form.description ?? ''}
                onChange={(e) =>
                  setForm((current) => ({ ...current, description: e.target.value }))
                }
                placeholder="Short bio shown under the card when provided."
                rows={3}
              />
              <span className="field__hint">{APP_FIELD_HINTS.description}</span>
            </label>
          </div>

          <div className="producer-form__preview">
            <p className="producer-form__preview-label">App preview (My favorites)</p>
            <div className="producer-preview-card">
              <div className="producer-avatar producer-avatar--lg">
                {form.logo_url?.trim() ? (
                  <img src={form.logo_url.trim()} alt="" />
                ) : (
                  <span>{form.name.trim().charAt(0).toUpperCase() || 'P'}</span>
                )}
              </div>
              <div>
                <strong>{form.name.trim().toUpperCase() || 'PROMOTER NAME'}</strong>
                <p className="muted">
                  {form.type_label?.trim() || 'Event producer'}
                </p>
                <p className="muted">
                  {form.coverage_label?.trim() || 'Events across Chile'}
                </p>
                {form.description?.trim() ? (
                  <p className="muted producer-preview-card__bio">{form.description.trim()}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="producer-form__actions">
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add producer'}
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
          <h3>All producers</h3>
          <div className="table-card__tools">
            <input
              className="table-card__search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search name, type, coverage…"
            />
            <span className="muted">{filtered.length} shown</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No producers yet"
            description="Add your first promoter above — it will appear in Events → Promoter."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Producer</th>
                <th>Type</th>
                <th>Coverage</th>
                <th>Followers</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((producer) => (
                <tr
                  key={producer.id}
                  className={editingId === producer.id ? 'data-table__row--active' : ''}
                >
                  <td>
                    <div className="producer-row">
                      <div className="producer-avatar">
                        {producer.logo_url ? (
                          <img src={producer.logo_url} alt="" />
                        ) : (
                          <span>{producer.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <strong>{producer.name}</strong>
                        <p className="muted">
                          {producer.description?.trim() || 'No description'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{producer.type_label ?? '—'}</td>
                  <td>{producer.coverage_label ?? '—'}</td>
                  <td>{producer.follower_count}</td>
                  <td>{formatDate(producer.created_at)}</td>
                  <td className="cell-actions">
                    <button
                      className="ghost-btn ghost-btn--sm"
                      type="button"
                      onClick={() => startEdit(producer)}
                    >
                      Edit
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
