import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  AdminTicketOffering,
  AdminTicketOfferingInput,
} from '../api/client';
import { Alert } from './ui/Alert';
import { Panel } from './ui/Panel';
import { StatusPill } from './ui/StatusPill';

const GENERAL_TYPES = [
  { value: 'early_bird', label: 'Early Bird' },
  { value: 'preventa_2', label: 'Pre-sale 2nd wave' },
  { value: 'preventa_3', label: 'Pre-sale 3rd wave' },
  { value: 'general', label: 'General' },
] as const;

const VIP_TYPES = [{ value: 'vip_general', label: 'VIP General' }] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'sold_out', label: 'Sold out' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
] as const;

const EMPTY_OFFERING = (section: 'general' | 'vip'): AdminTicketOfferingInput => ({
  type: section === 'vip' ? 'vip_general' : 'early_bird',
  name: section === 'vip' ? 'VIP General' : 'Early Bird',
  price: section === 'vip' ? 35000 : 10000,
  display_order: 0,
  stock_total: undefined,
  stock_remaining: undefined,
  sale_start_at: null,
  sale_end_at: null,
  status: 'active',
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

  const typeOptions = section === 'general' ? GENERAL_TYPES : VIP_TYPES;

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
      type: offering.type,
      name: offering.name,
      price: offering.price,
      display_order: offering.display_order,
      stock_total: offering.stock_total ?? undefined,
      stock_remaining: offering.stock_remaining ?? undefined,
      sale_start_at: offering.sale_start_at ?? null,
      sale_end_at: offering.sale_end_at ?? null,
      status: offering.status,
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
      stock_total: form.stock_total ?? null,
      stock_remaining:
        form.stock_remaining ??
        (form.stock_total != null ? form.stock_total : null),
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

      {editingId || form.name ? (
        <form className="form-grid form-grid--3" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Type</span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value as AdminTicketOfferingInput['type'],
                }))
              }
              required
              disabled={Boolean(editingId)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Name (shown in app)</span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
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
            <span className="field__label">Stock total</span>
            <input
              type="number"
              min={1}
              value={form.stock_total ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  stock_total: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
              placeholder="Unlimited if empty"
            />
          </label>

          <label className="field">
            <span className="field__label">Stock remaining</span>
            <input
              type="number"
              min={0}
              value={form.stock_remaining ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  stock_remaining: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
              placeholder="Defaults to total on create"
            />
          </label>

          <label className="field">
            <span className="field__label">Sale starts</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(form.sale_start_at)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sale_start_at: fromDatetimeLocalValue(e.target.value),
                }))
              }
            />
          </label>

          <label className="field">
            <span className="field__label">Sale ends</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(form.sale_end_at)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sale_end_at: fromDatetimeLocalValue(e.target.value),
                }))
              }
            />
          </label>

          <label className="field">
            <span className="field__label">Status</span>
            <select
              value={form.status ?? 'active'}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as AdminTicketOfferingInput['status'],
                }))
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                  <strong>{offering.name}</strong>
                  <div className="muted">{offering.type}</div>
                </td>
                <td>
                  {offering.price.toLocaleString()} {offering.currency}
                </td>
                <td>
                  {offering.stock_total != null
                    ? `${offering.sold_quantity ?? 0} / ${offering.stock_total}`
                    : `${offering.sold_quantity ?? 0} sold · unlimited`}
                </td>
                <td>
                  {offering.is_sold_out ? (
                    <StatusPill tone="neutral" label="Sold out" />
                  ) : offering.is_selectable ? (
                    <StatusPill tone="success" label="Available" />
                  ) : (
                    <StatusPill tone="neutral" label={offering.status} />
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
