import { FormEvent, useEffect, useState } from 'react';
import {
  adminApi,
  AdminVenueLayout,
  AdminVenueLayoutInput,
  AdminVenueTable,
  AdminVenueTableInput,
  AdminVenueZone,
  AdminVenueZoneInput,
  PhysicalVenue,
} from '../api/client';
import { Alert } from './ui/Alert';
import { Panel } from './ui/Panel';
import { StatusPill } from './ui/StatusPill';

const EMPTY_LAYOUT: AdminVenueLayoutInput = {
  venue_name: '',
  width_meters: 36,
  height_meters: 18,
  table_lock_minutes: 10,
};

const EMPTY_ZONE: AdminVenueZoneInput = {
  external_id: '',
  name: '',
  kind: 'vip_table_zone',
  position_x: 10,
  position_y: 20,
  size_width: 25,
  size_height: 30,
  color: 'green',
  capacity_per_table: 10,
  is_selectable: true,
  display_order: 0,
};

const EMPTY_TABLE: AdminVenueTableInput = {
  external_id: '',
  number: 1,
  label: 'M1',
  position_x: 5,
  position_y: 5,
  price: 320000,
  capacity: 10,
  bottle_count: 2,
  voucher_count: 20,
};

type Props = {
  eventId: string;
  eventTitle: string;
  venueName?: string;
};

export function EventVenueLayoutPanel({ eventId, eventTitle, venueName }: Props) {
  const [layout, setLayout] = useState<AdminVenueLayout | null>(null);
  const [venues, setVenues] = useState<PhysicalVenue[]>([]);
  const [layoutForm, setLayoutForm] = useState<AdminVenueLayoutInput>(EMPTY_LAYOUT);
  const [zoneForm, setZoneForm] = useState<AdminVenueZoneInput>(EMPTY_ZONE);
  const [tableForm, setTableForm] = useState<AdminVenueTableInput>(EMPTY_TABLE);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [bulkTableCount, setBulkTableCount] = useState(8);
  const [bulkTablePrice, setBulkTablePrice] = useState(320000);
  const [bulkTablePrefix, setBulkTablePrefix] = useState('M');

  const selectedZone = layout?.zones.find((zone) => zone.zone_id === selectedZoneId) ?? null;

  async function load() {
    setLoading(true);
    const [layoutResult, venuesResult] = await Promise.all([
      adminApi.eventVenueLayout(eventId),
      adminApi.venues(),
    ]);
    setLoading(false);
    if (!layoutResult.ok) {
      setError(layoutResult.error ?? 'Failed to load venue layout');
      return;
    }
    setVenues(venuesResult.ok ? (venuesResult.data?.venues ?? []) : []);
    const nextLayout = layoutResult.data?.layout ?? null;
    setLayout(nextLayout);
    if (nextLayout) {
      setLayoutForm({
        venue_id: nextLayout.venue_id ?? undefined,
        venue_name: nextLayout.venue_name,
        width_meters: nextLayout.width_meters,
        height_meters: nextLayout.height_meters,
        table_lock_minutes: nextLayout.table_lock_minutes ?? 10,
      });
      if (!selectedZoneId && nextLayout.zones[0]) {
        setSelectedZoneId(nextLayout.zones[0].zone_id);
      }
    } else {
      setLayoutForm({
        venue_name: venueName ? `${venueName} - Main Hall` : `${eventTitle} - Main Hall`,
        width_meters: 36,
        height_meters: 18,
      });
    }
    setError('');
  }

  useEffect(() => {
    void load();
  }, [eventId]);

  function selectPhysicalVenue(venueId: string) {
    if (!venueId) {
      setLayoutForm((prev) => ({ ...prev, venue_id: undefined }));
      return;
    }
    const venue = venues.find((item) => item.id === venueId);
    if (!venue) return;
    setLayoutForm((prev) => ({
      ...prev,
      venue_id: venue.id,
      venue_name: venue.name,
      width_meters: venue.dimensions.width_meters,
      height_meters: venue.dimensions.height_meters,
    }));
  }

  async function saveLayout(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const result = await adminApi.upsertVenueLayout(eventId, layoutForm);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save floor plan');
      return;
    }
    setMessage(layout ? 'Floor plan updated.' : 'Floor plan created.');
    await load();
  }

  async function removeLayout() {
    if (!window.confirm('Delete the entire floor plan, zones, and tables?')) return;
    const result = await adminApi.deleteVenueLayout(eventId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to delete floor plan');
      return;
    }
    setMessage('Floor plan deleted.');
    setSelectedZoneId(null);
    await load();
  }

  async function saveZone(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const result = editingZoneId
      ? await adminApi.updateVenueZone(eventId, editingZoneId, zoneForm)
      : await adminApi.createVenueZone(eventId, zoneForm);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save zone');
      return;
    }
    setMessage(editingZoneId ? 'Zone updated.' : 'Zone created.');
    setZoneForm(EMPTY_ZONE);
    setEditingZoneId(null);
    await load();
  }

  function startEditZone(zone: AdminVenueZone) {
    setEditingZoneId(zone.zone_id);
    setSelectedZoneId(zone.zone_id);
    setZoneForm({
      external_id: zone.external_id,
      name: zone.name,
      kind: zone.kind,
      status: zone.status,
      position_x: zone.position_x,
      position_y: zone.position_y,
      size_width: zone.size_width,
      size_height: zone.size_height,
      color: zone.color,
      capacity_per_table: zone.capacity_per_table ?? undefined,
      is_selectable: zone.is_selectable,
      display_order: zone.display_order,
    });
  }

  async function removeZone(zoneId: string) {
    if (!window.confirm('Delete this zone and all its tables?')) return;
    const result = await adminApi.deleteVenueZone(eventId, zoneId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to delete zone');
      return;
    }
    setMessage('Zone deleted.');
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
    if (editingZoneId === zoneId) {
      setEditingZoneId(null);
      setZoneForm(EMPTY_ZONE);
    }
    await load();
  }

  async function saveTable(event: FormEvent) {
    event.preventDefault();
    if (!selectedZoneId) return;
    setSaving(true);
    setError('');
    setMessage('');
    const result = editingTableId
      ? await adminApi.updateVenueTable(eventId, selectedZoneId, editingTableId, tableForm)
      : await adminApi.createVenueTable(eventId, selectedZoneId, tableForm);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save table');
      return;
    }
    setMessage(editingTableId ? 'Table updated.' : 'Table created.');
    setTableForm(EMPTY_TABLE);
    setEditingTableId(null);
    await load();
  }

  function startEditTable(table: AdminVenueTable) {
    setEditingTableId(table.table_id);
    setTableForm({
      external_id: table.external_id,
      number: table.number,
      label: table.label,
      status: table.status,
      position_x: table.position_x,
      position_y: table.position_y,
      price: table.price,
      capacity: table.capacity,
      bottle_count: table.bottle_count,
      voucher_count: table.voucher_count,
    });
  }

  async function removeTable(tableId: string) {
    if (!selectedZoneId) return;
    if (!window.confirm('Delete this table?')) return;
    const result = await adminApi.deleteVenueTable(eventId, selectedZoneId, tableId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to delete table');
      return;
    }
    setMessage('Table deleted.');
    if (editingTableId === tableId) {
      setEditingTableId(null);
      setTableForm(EMPTY_TABLE);
    }
    await load();
  }

  async function bulkAddTables() {
    if (!selectedZoneId || !selectedZone) return;
    setSaving(true);
    setError('');
    setMessage('');

    const startNumber = selectedZone.tables.length + 1;
    for (let index = 0; index < bulkTableCount; index += 1) {
      const number = startNumber + index;
      const label = `${bulkTablePrefix}${number}`;
      const result = await adminApi.createVenueTable(eventId, selectedZoneId, {
        external_id: `table-${selectedZone.external_id}-${label.toLowerCase()}`,
        number,
        label,
        position_x: 5 + (index % 4) * 12,
        position_y: 5 + Math.floor(index / 4) * 12,
        price: bulkTablePrice,
        capacity: selectedZone.capacity_per_table ?? 10,
        bottle_count: selectedZone.kind === 'vip_premium_zone' ? 3 : 2,
        voucher_count: selectedZone.kind === 'vip_premium_zone' ? 30 : 20,
      });
      if (!result.ok) {
        setSaving(false);
        setError(result.error ?? `Failed at table ${label}`);
        return;
      }
    }

    setSaving(false);
    setMessage(`Added ${bulkTableCount} tables to ${selectedZone.name}.`);
    await load();
  }

  return (
    <Panel
      title="3 · VIP zones & tables"
      description={`Floor plan for “${eventTitle}”. Zones appear on the Venue floor plan screen; tables (M1, M2…) appear when a guest taps a zone.`}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <p className="muted" style={{ marginBottom: 16 }}>
        <strong>Zones ≠ tickets.</strong> Zones (VIP 1, VIP DJ, Dance floor) are areas on the map.
        Only zones with kind <em>VIP table zone</em> or <em>VIP premium zone</em> hold purchasable
        tables. Quantity ticket stock is in sections 1 &amp; 2 above.
      </p>

      <form className="form-grid form-grid--3" onSubmit={saveLayout}>
        <label className="field form-grid__full">
          <span className="field__label">Physical venue (catalog)</span>
          <select
            value={layoutForm.venue_id ?? ''}
            onChange={(e) => selectPhysicalVenue(e.target.value)}
          >
            <option value="">Custom floor plan dimensions</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} — {venue.dimensions.width_meters}m × {venue.dimensions.height_meters}m
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Floor plan name</span>
          <input
            value={layoutForm.venue_name}
            onChange={(e) => setLayoutForm((prev) => ({ ...prev, venue_name: e.target.value }))}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Width (m)</span>
          <input
            type="number"
            step="any"
            min={1}
            value={layoutForm.width_meters}
            onChange={(e) =>
              setLayoutForm((prev) => ({ ...prev, width_meters: Number(e.target.value) }))
            }
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Table lock (minutes)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={layoutForm.table_lock_minutes ?? 10}
            onChange={(e) =>
              setLayoutForm((prev) => ({
                ...prev,
                table_lock_minutes: Number(e.target.value),
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
            value={layoutForm.height_meters}
            onChange={(e) =>
              setLayoutForm((prev) => ({ ...prev, height_meters: Number(e.target.value) }))
            }
            required
          />
        </label>
        <div className="form-actions form-grid__full">
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : layout ? 'Save floor plan' : 'Create floor plan'}
          </button>
          {layout ? (
            <button className="ghost-btn" type="button" onClick={() => void removeLayout()}>
              Delete floor plan
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading floor plan…</p>
      ) : !layout ? (
        <p className="muted">No floor plan yet. Create one above, then add VIP zones and tables.</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 8 }}>
            {layout.total_zones} zones · {layout.total_tables} tables · {layout.available_tables}{' '}
            available · {layout.sold_tables} sold
          </p>

          <h4 style={{ marginTop: 24 }}>Zones (floor plan map)</h4>
          <p className="muted">
            These names appear on the app floor plan — e.g. “ZONE VIP 1”, “ZONE VIP DJ”.
          </p>
          <form className="form-grid form-grid--3" onSubmit={saveZone}>
            <label className="field">
              <span className="field__label">Zone ID</span>
              <input
                value={zoneForm.external_id}
                onChange={(e) => setZoneForm((prev) => ({ ...prev, external_id: e.target.value }))}
                placeholder="vip-1"
                required
                disabled={Boolean(editingZoneId)}
              />
            </label>
            <label className="field">
              <span className="field__label">Name</span>
              <input
                value={zoneForm.name}
                onChange={(e) => setZoneForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Kind</span>
              <select
                value={zoneForm.kind}
                onChange={(e) =>
                  setZoneForm((prev) => ({
                    ...prev,
                    kind: e.target.value as AdminVenueZoneInput['kind'],
                  }))
                }
              >
                <option value="vip_table_zone">VIP table zone</option>
                <option value="vip_premium_zone">VIP premium zone</option>
                <option value="stage">Stage</option>
                <option value="general_floor">General floor</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Color</span>
              <input
                value={zoneForm.color}
                onChange={(e) => setZoneForm((prev) => ({ ...prev, color: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field__label">Seats per table</span>
              <input
                type="number"
                min={1}
                value={zoneForm.capacity_per_table ?? ''}
                onChange={(e) =>
                  setZoneForm((prev) => ({
                    ...prev,
                    capacity_per_table:
                      e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={zoneForm.is_selectable ?? true}
                onChange={(e) =>
                  setZoneForm((prev) => ({ ...prev, is_selectable: e.target.checked }))
                }
              />
              <span>Selectable in app</span>
            </label>
            <div className="form-actions form-grid__full">
              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingZoneId ? 'Save zone' : 'Add zone'}
              </button>
              {editingZoneId ? (
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => {
                    setEditingZoneId(null);
                    setZoneForm(EMPTY_ZONE);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {layout.zones.length > 0 ? (
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Kind</th>
                  <th>Tables</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {layout.zones.map((zone) => (
                  <tr key={zone.zone_id}>
                    <td>
                      <strong>{zone.name}</strong>
                      <div className="muted">{zone.external_id}</div>
                    </td>
                    <td>{zone.kind}</td>
                    <td>{zone.total_tables}</td>
                    <td>
                      {zone.available_tables} available / {zone.sold_tables} sold
                    </td>
                    <td>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => setSelectedZoneId(zone.zone_id)}
                      >
                        Tables
                      </button>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => startEditZone(zone)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => void removeZone(zone.zone_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No zones yet. Add a VIP table zone above.</p>
          )}

          {selectedZone ? (
            <>
              <h4 style={{ marginTop: 24 }}>Tables in {selectedZone.name}</h4>
              <p className="muted">
                Each table is one reservation (e.g. M6 → “Reserve Table 6” in the app). Stock = table
                status.
              </p>

              <div className="purchase-config__bulk">
                <strong>Quick add tables</strong>
                <div className="form-grid form-grid--3" style={{ marginTop: 8 }}>
                  <label className="field">
                    <span className="field__label">Count</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={bulkTableCount}
                      onChange={(e) => setBulkTableCount(Number(e.target.value))}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Label prefix</span>
                    <input
                      value={bulkTablePrefix}
                      onChange={(e) => setBulkTablePrefix(e.target.value)}
                      placeholder="M"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Price each (CLP)</span>
                    <input
                      type="number"
                      min={1}
                      value={bulkTablePrice}
                      onChange={(e) => setBulkTablePrice(Number(e.target.value))}
                    />
                  </label>
                </div>
                <button
                  className="ghost-btn"
                  type="button"
                  disabled={saving}
                  onClick={() => void bulkAddTables()}
                >
                  Add {bulkTableCount} tables ({bulkTablePrefix}1…)
                </button>
              </div>
              <form className="form-grid form-grid--3" onSubmit={saveTable}>
                <label className="field">
                  <span className="field__label">Table ID</span>
                  <input
                    value={tableForm.external_id}
                    onChange={(e) =>
                      setTableForm((prev) => ({ ...prev, external_id: e.target.value }))
                    }
                    placeholder="table-vip-1-m1"
                    required
                    disabled={Boolean(editingTableId)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Label</span>
                  <input
                    value={tableForm.label}
                    onChange={(e) => setTableForm((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="M1"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field__label">Number</span>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.number}
                    onChange={(e) =>
                      setTableForm((prev) => ({ ...prev, number: Number(e.target.value) }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span className="field__label">Price (CLP)</span>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.price}
                    onChange={(e) =>
                      setTableForm((prev) => ({ ...prev, price: Number(e.target.value) }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span className="field__label">Capacity</span>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.capacity ?? ''}
                    onChange={(e) =>
                      setTableForm((prev) => ({
                        ...prev,
                        capacity: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">Status</span>
                  <select
                    value={tableForm.status ?? 'available'}
                    onChange={(e) =>
                      setTableForm((prev) => ({
                        ...prev,
                        status: e.target.value as AdminVenueTableInput['status'],
                      }))
                    }
                  >
                    <option value="available">Available</option>
                    <option value="locked">Locked</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                  </select>
                </label>
                <div className="form-actions form-grid__full">
                  <button className="primary-btn" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : editingTableId ? 'Save table' : 'Add table'}
                  </button>
                  {editingTableId ? (
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => {
                        setEditingTableId(null);
                        setTableForm(EMPTY_TABLE);
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              {selectedZone.tables.length > 0 ? (
                <table className="data-table" style={{ marginTop: 16 }}>
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Price</th>
                      <th>Capacity</th>
                      <th>Includes</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedZone.tables.map((table) => (
                      <tr key={table.table_id}>
                        <td>
                          <strong>{table.label}</strong>
                          <div className="muted">{table.external_id}</div>
                        </td>
                        <td>
                          {table.price.toLocaleString()} {table.currency}
                        </td>
                        <td>{table.capacity}</td>
                        <td>
                          {table.bottle_count} bottles · {table.voucher_count} vouchers
                        </td>
                        <td>
                          {table.status === 'sold' ? (
                            <StatusPill tone="neutral" label="Sold" />
                          ) : table.status === 'locked' || table.status === 'reserved' ? (
                            <StatusPill tone="warning" label={table.status} />
                          ) : (
                            <StatusPill tone="success" label="Available" />
                          )}
                          {table.sold_at ? (
                            <div className="muted">Sold {new Date(table.sold_at).toLocaleString()}</div>
                          ) : null}
                          {table.locked_until && table.status !== 'sold' ? (
                            <div className="muted">
                              Lock until {new Date(table.locked_until).toLocaleString()}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => startEditTable(table)}
                          >
                            Edit
                          </button>
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => void removeTable(table.table_id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No tables in this zone yet.</p>
              )}
            </>
          ) : null}
        </>
      )}
    </Panel>
  );
}
