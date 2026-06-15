# Flutter — Ticket Purchase Integration Guide

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

Handoff for the **Buy tickets** flow: general pre-sales, VIP General, VIP tables, floor plan, lock, and checkout.

**Related docs:**
- [FLUTTER_VIP_VENUE_API.md](./FLUTTER_VIP_VENUE_API.md) — full endpoint reference
- [FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md) — event list & detail
- [FLUTTER_GUEST_TICKETS_API.md](./FLUTTER_GUEST_TICKETS_API.md) — post-purchase assignment

---

## Summary: what Flutter must change

| Area | Backend | Admin | Flutter |
|------|---------|-------|---------|
| Ticket types (Early Bird, Pre-sale 2/3, General, VIP General, VIP Table) | Done | Done | **Yes** — models + UI rules below |
| Promoter sets stock & prices | Done | Done | No — read from API |
| Hide numeric availability | Stock removed from public API | Shows stock to promoter | **Yes** — never show counts |
| Sold out = disable button only | `is_sold_out` / `is_selectable` | — | **Yes** |
| No quantity cap in app | No `max_per_order`; stock enforced at checkout | — | **Yes** — no client max |
| 10-minute table lock | Done (`table_lock_minutes: 10`) | Configurable | **Yes** — lock before checkout |
| Seats per table (VIP 1/2 = 10, VIP DJ = 15) | `capacity` on zone/table | Set on zone | **Yes** — use `capacity`, don’t hardcode |
| YouFest-style floor plan | Layout API returns positions | Admin configures | **Yes** — render from API |
| VIP table includes (bottles, vouchers) | `includes` JSON on table | Editable | **Yes** — display when client copy ready |
| Custom zone types / layout templates | Pending product decision | Pending | Pending |

---

## 1. Ticket types — data model

### API: `GET /events/:eventId/ticket-types`

Public response **does not** include stock numbers (`stock_total`, `sold_quantity`, etc.). Use flags only.

```json
{
  "success": true,
  "data": {
    "event_id": "...",
    "service_fee_rate": 0.05,
    "currency": "CLP",
    "offerings": [
      {
        "id": "early_bird",
        "offering_id": "MONGODB_ID",
        "type": "early_bird",
        "name": "Early Bird",
        "slug": "early_bird",
        "label": "Early Bird",
        "section": "general",
        "price": 10000,
        "currency": "CLP",
        "status": "active",
        "is_sold_out": false,
        "is_selectable": true,
        "maps_to_tier": "general",
        "maps_to_type": "general"
      }
    ]
  }
}
```

### Type enum (one per event)

| `type` | App section | Legacy checkout ref (still accepted) |
|--------|-------------|--------------------------------------|
| `early_bird` | General | `preventa-1` |
| `preventa_2` | General | `preventa-2` |
| `preventa_3` | General | `preventa-3` |
| `general` | General | `general-cover` |
| `vip_general` | VIP admission | `vip-general` |
| *(VIP table)* | VIP tables | use `table_id` at checkout |

### Dart model

```dart
class TicketOffering {
  final String offeringId;   // offering_id — use in checkout
  final String type;         // early_bird, preventa_2, ...
  final String name;
  final String section;      // general | vip
  final int price;
  final String currency;
  final bool isSoldOut;      // is_sold_out
  final bool isSelectable;   // is_selectable

  factory TicketOffering.fromJson(Map<String, dynamic> json) {
    return TicketOffering(
      offeringId: json['offering_id'] as String,
      type: json['type'] as String? ?? json['slug'] as String,
      name: json['name'] as String? ?? json['label'] as String,
      section: json['section'] as String,
      price: (json['price'] as num).toInt(),
      currency: json['currency'] as String,
      isSoldOut: json['is_sold_out'] as bool? ?? false,
      isSelectable: json['is_selectable'] as bool? ?? true,
    );
  }
}
```

### Migration from old slugs

```dart
// OLD — remove hardcoded slug checks
if (offering.slug == 'preventa-1') { ... }

// NEW — use API fields
final waves = offerings.where((o) => o.section == 'general').toList();
final canBuy = offering.isSelectable && !offering.isSoldOut;
```

---

## 2. UX rules (product requirements)

### Do NOT show numeric availability

- Do **not** display `stock_total`, `stock_remaining`, `sold_quantity`, or zone counts like `available_tables`.
- Public ticket-types API no longer returns stock fields.
- Realtime polling may still return per-table `status` — use status colors, not counts.

### Sold out — disable button only

```dart
Widget buildBuyButton(TicketOffering offering) {
  final disabled = offering.isSoldOut || !offering.isSelectable;
  return ElevatedButton(
    onPressed: disabled ? null : () => onSelect(offering),
    child: Text(disabled ? 'Sold out' : 'Select'),
  );
}
```

- Keep sold-out rows **visible** in the list.
- Do **not** hide waves when `status == sold_out`.

### Quantity stepper — no app-side maximum

- Do **not** read or enforce `max_per_order` (removed from API).
- Let the user pick any quantity ≥ 1.
- Backend rejects over-stock with `INSUFFICIENT_STOCK` (409) — show a friendly error and refresh ticket types.

```dart
// No client cap
int quantity = 1;
void increment() => quantity++;  // not: min(quantity + 1, 10)
```

### VIP table — one table per purchase

- Checkout with `table_id` buys **one** table.
- `capacity` = seats included (invitations to assign), not “tickets left”.
- Show capacity as “Up to 10 guests” / “Up to 15 guests” — not as remaining stock.

| Zone | Default capacity |
|------|------------------|
| VIP 1 | 10 |
| VIP 2 | 10 |
| VIP DJ | 15 |

Read from `zone.capacity_per_table` or `table.capacity` — do not hardcode.

---

## 3. VIP floor plan

### Load layout

`GET /events/:eventId/venue-layout`

```dart
class VenueLayout {
  final String? physicalVenueId;  // venue_id — catalog
  final String layoutVenueId;     // layout_venue_id — floor plan doc
  final int tableLockMinutes;     // table_lock_minutes (default 10)
  final List<VenueZone> zones;
}
```

**Important:** `venue_id` is the physical venue catalog id. Use `layout_venue_id` if you need the floor-plan document id.

### Zone types

`vip_table_zone` · `vip_premium_zone` · `stage` · `general_floor`

Only `vip_table_zone` and `vip_premium_zone` are selectable for table purchase.

### Table status (UI)

| API `status` | UI |
|--------------|-----|
| `available` | Selectable |
| `locked` | Held by someone — show as unavailable |
| `reserved` | Unavailable |
| `sold` | Sold out — disable, keep visible |

Use `status` for colors. Ignore `db_status` if present.

### Table includes (optional display)

```json
"includes": {
  "bottles": 2,
  "bar_vouchers": 20,
  "extras": ["premium_service"]
}
```

Copy for labels is pending from client — structure is ready.

---

## 4. Table lock (10 minutes)

**When:** Call lock when the user **starts checkout** on a VIP table (or taps “Reserve” before payment).

```
POST /events/:eventId/tables/:tableId/lock
Authorization: Bearer <token>
```

Response includes `expires_in_seconds` / `locked_until`.

```
DELETE /events/:eventId/tables/:tableId/lock   // release if user cancels
```

**Checkout requires active lock:**

```
POST /events/:eventId/checkout
{ "table_id": "...", "zone_id": "...", "tier": "vip", "type": "vip_table" }
```

If lock expired → `TABLE_LOCK_REQUIRED` (409). Re-lock and retry.

```dart
Future<void> checkoutTable(String tableId) async {
  await api.lockTable(eventId, tableId);
  try {
    await api.checkout(eventId, tableId: tableId, zoneId: zoneId);
  } catch (e) {
    if (e.code == 'TABLE_LOCK_REQUIRED') {
      await api.lockTable(eventId, tableId);
      await api.checkout(...);
    }
  }
}
```

Poll `GET .../tables/availability/realtime` every 15–30s on floor-plan screens.

---

## 5. Checkout payloads

### General / VIP General (single wave)

```json
{
  "offering_id": "MONGODB_ID_OR_early_bird",
  "quantity": 3
}
```

Prefer MongoDB `offering_id` from ticket-types response.

### VIP table

1. `POST .../tables/:tableId/lock`
2. `POST .../checkout` with `table_id` + `zone_id`

### Errors to handle

| Code | HTTP | Flutter action |
|------|------|----------------|
| `TICKET_OFFERING_SOLD_OUT` | 409 | Refresh list, disable row |
| `INSUFFICIENT_STOCK` | 409 | Show error, lower quantity or refresh |
| `TABLE_NOT_AVAILABLE` | 409 | Refresh floor plan |
| `TABLE_LOCKED` | 409 | Table held by another user |
| `TABLE_LOCK_REQUIRED` | 409 | Call lock, retry checkout |

---

## 6. Screen checklist

| Screen | API | Flutter tasks |
|--------|-----|---------------|
| Event detail | `GET /events/:id` | Use `purchase.has_ticket_offerings`, `has_venue_layout` |
| Ticket selection | `GET /events/:id/ticket-types` | New model; sold-out = disabled button; no stock numbers |
| VIP admission | Same offerings, `section == vip` | VIP General row |
| Floor plan | `GET /events/:id/venue-layout` | Render zones from `position` / sizes |
| Table map | `GET .../zones/:zoneId/tables` | Status colors; show `capacity`; optional `includes` |
| Reserve / checkout | `POST .../lock` → `POST .../checkout` | 10-min lock flow |
| Success | Checkout response `ticket_id` | QR flow per FLUTTER_TICKETS_API |

---

## 7. Pending (no Flutter work until client decides)

1. **VIP table includes copy** — free-text block from client for bottles/vouchers/extras labels.
2. **Custom table zone types** (Premium, Standard, Floor, Terrace) vs fixed VIP 1 / VIP DJ / VIP 2.
3. **Pre-configured layout templates** for MVP — how many floor plans ship initially.

---

## 8. Quick test (curl)

```bash
BASE=https://youpass-backend.vercel.app/api/v1
EVENT_ID=6a1fdcd36acaa91b865e7261

curl -s "$BASE/events/$EVENT_ID/ticket-types" | jq '.data.offerings[] | {type, name, is_sold_out, is_selectable}'
curl -s "$BASE/events/$EVENT_ID/venue-layout" | jq '.data | {table_lock_minutes, zones: [.zones[].name]}'
```
