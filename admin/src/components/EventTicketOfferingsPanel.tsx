import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  AdminTicketOffering,
  AdminTicketOfferingInput,
} from '../api/client';
import { Alert } from './ui/Alert';
import { Panel } from './ui/Panel';
import { StatusPill } from './ui/StatusPill';

const EMPTY_OFFERING = (section: 'general' | 'vip'): AdminTicketOfferingInput => ({
  slug: '',
  label: '',
  description: '',
  section,
  price: section === 'vip' ? 35000 : 10000,
  badge_label: '',
  display_order: 0,
  stock_quantity: undefined,
  sale_starts_at: null,
  sale_ends_at: null,
  is_active: true,
});

function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

type Props = {
  eventId: string;
  eventTitle: string;
  section: 'general' | 'vip';
  title: string;
  description: string;
};

export function EventTicketOfferingsPanel({
  eventId,
  section,
  title,
  description,
}: Props) {
  const [offerings, setOfferings] = useState<AdminTicketOffering[]>([]);
  const [form, setForm] = useState<AdminTicketOfferingInput>(EMPTY_OFFERING(section));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sectionOfferings = useMemo(
    () => offerings.filter((offering) => offering.section === section),
    [offerings, section],
  );

  async function load() {
    setLoading(true);
    const result = await adminApi.eventTicketOfferings(eventId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to load ticket types');
      return;
    }
    setOfferings(result.data?.offerings ?? []);
  }

  useEffect(() => {
    void load();
  }, [eventId]);

  function resetForm() {
    setForm(EMPTY_OFFERING(section));
    setEditingId(null);
  }

  function startEdit(offering: AdminTicketOffering) {
    setEditingId(offering.offering_id);
    setForm({
      slug: offering.slug,
      label: offering.label,
      description: offering.description ?? '',
      section: offering.section,
      price: offering.price,
      badge_label: offering.badge_label ?? '',
      display_order: offering.display_order,
      stock_quantity: offering.stock_quantity ?? undefined,
      sale_starts_at: offering.sale_starts_at ?? null,
      sale_ends_at: offering.sale_ends_at ?? null,
      is_active: offering.is_active,
    });
  }

  function startAdd() {
    resetForm();
    setForm(EMPTY_OFFERING(section));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload: AdminTicketOfferingInput = {
      ...form,
      section,
      description: form.description?.trim() || null,
      badge_label: form.badge_label?.trim() || null,
      stock_quantity: form.stock_quantity ?? null,
    };

    const result = editingId
      ? await adminApi.updateTicketOffering(eventId, editingId, payload)
      : await adminApi.createTicketOffering(eventId, payload);

    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save ticket type');
      return;
    }

    setMessage(editingId ? 'Ticket type updated.' : 'Ticket type created.');
    resetForm();
    await load();
  }

  async function handleDelete(offeringId: string) {
    if (!window.confirm('Delete this ticket type?')) return;
    const result = await adminApi.deleteTicketOffering(eventId, offeringId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to delete ticket type');
      return;
    }
    setMessage('Ticket type deleted.');
    if (editingId === offeringId) resetForm();
    await load();
  }

  return (
    <Panel title={title} description={description}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="purchase-config__toolbar">
        <button className="primary-btn" type="button" onClick={startAdd}>
          Add {section === 'general' ? 'general' : 'VIP General'} wave
        </button>
        <span className="muted">
          {sectionOfferings.length} wave{sectionOfferings.length === 1 ? '' : 's'} configured
        </span>
      </div>

      {editingId || form.slug || form.label ? (
        <form className="form-grid form-grid--3" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Slug (unique ID)</span>
            <input
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder={section === 'general' ? 'preventa-1' : 'vip-general'}
              required
              disabled={Boolean(editingId)}
            />
          </label>

          <label className="field">
            <span className="field__label">Label (shown in app)</span>
            <input
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder={section === 'general' ? 'Early Bird' : 'VIP General'}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Price (CLP)</span>
            <input
              type="number"
              min={1}
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Badge label</span>
            <input
              value={form.badge_label ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, badge_label: e.target.value }))}
              placeholder="Early bird"
            />
          </label>

          <label className="field">
            <span className="field__label">Display order</span>
            <input
              type="number"
              min={0}
              value={form.display_order ?? 0}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, display_order: Number(e.target.value) }))
              }
            />
          </label>

          <label className="field">
            <span className="field__label">Stock quantity</span>
            <input
              type="number"
              min={1}
              value={form.stock_quantity ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  stock_quantity: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
              placeholder="Unlimited if empty"
            />
          </label>

          <label className="field">
            <span className="field__label">Sale starts</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(form.sale_starts_at)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sale_starts_at: fromDatetimeLocalValue(e.target.value),
                }))
              }
            />
          </label>

          <label className="field">
            <span className="field__label">Sale ends</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(form.sale_ends_at)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sale_ends_at: fromDatetimeLocalValue(e.target.value),
                }))
              }
            />
          </label>

          <label className="field form-grid__full">
            <span className="field__label">Description</span>
            <textarea
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Access from 22:00 · includes 2 drinks"
            />
          </label>

          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            <span>Active (visible when in stock)</span>
          </label>

          <div className="form-actions form-grid__full">
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save wave' : 'Create wave'}
            </button>
            <button className="ghost-btn" type="button" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : sectionOfferings.length === 0 ? (
        <p className="muted">
          No {section === 'general' ? 'general' : 'VIP General'} waves yet. Click “Add wave” above.
        </p>
      ) : (
        <table className="data-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Wave</th>
              <th>Price</th>
              <th>Stock (sold / total)</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sectionOfferings.map((offering) => (
              <tr key={offering.offering_id}>
                <td>
                  <strong>{offering.label}</strong>
                  <div className="muted">{offering.slug}</div>
                  {offering.description ? (
                    <div className="muted">{offering.description}</div>
                  ) : null}
                </td>
                <td>
                  {offering.price.toLocaleString()} {offering.currency}
                </td>
                <td>
                  {offering.stock_quantity != null
                    ? `${offering.sold_quantity ?? 0} / ${offering.stock_quantity}`
                    : `${offering.sold_quantity ?? 0} sold · unlimited`}
                </td>
                <td>
                  {offering.is_sold_out ? (
                    <StatusPill tone="neutral" label="Sold out" />
                  ) : offering.is_selectable ? (
                    <StatusPill tone="success" label="Available" />
                  ) : (
                    <StatusPill tone="neutral" label="Inactive" />
                  )}
                </td>
                <td>
                  <button className="ghost-btn" type="button" onClick={() => startEdit(offering)}>
                    Edit
                  </button>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => void handleDelete(offering.offering_id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
