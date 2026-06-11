# Flutter — VIP Venue & Ticket Purchase API

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

APIs for **VIP venue map**, **ticket offerings**, **table lock**, and **checkout** (general + VIP table). Replaces `VipVenueMockData` in Flutter.

Related docs:
- [FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md) — event list & detail
- [FLUTTER_GUEST_TICKETS_API.md](./FLUTTER_GUEST_TICKETS_API.md) — post-purchase assignment

---

## Quick reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events/:eventId` | Optional | Event detail + `purchase` meta |
| GET | `/events/:eventId/ticket-types` | — | Ticket offerings (Preventa, VIP General, …) |
| GET | `/events/:eventId/venue-layout` | Optional | Floor plan + zones |
| GET | `/events/:eventId/zones/:zoneId/tables` | Optional | Tables in zone |
| GET | `/events/:eventId/tables/:tableId` | Optional | Single table detail |
| POST | `/events/:eventId/tables/:tableId/lock` | Bearer | 10-minute table hold |
| DELETE | `/events/:eventId/tables/:tableId/lock` | Bearer | Release hold |
| GET | `/events/:eventId/tables/availability/realtime` | Optional | Polling snapshot |
| POST | `/events/:eventId/checkout` | Bearer | Pay (general, offerings, or VIP table) |

Use **`eventId`** = MongoDB event `id` from list/detail (not slug).

---

## Event detail (enriched)

**`GET /events/:id`**

Existing fields plus:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "URBAN NIGHT LIVE",
    "venue_name": "BICENTENNIAL PARK",
    "purchase": {
      "service_fee_rate": 0.05,
      "currency": "CLP",
      "has_ticket_offerings": true,
      "has_venue_layout": true
    }
  }
}
```

- `has_ticket_offerings` → show ticket selection screen with API data
- `has_venue_layout` → enable **VIP Tables** floor plan

---

## Ticket types

**`GET /events/:eventId/ticket-types`**

```json
{
  "success": true,
  "data": {
    "event_id": "...",
    "service_fee_rate": 0.05,
    "offerings": [
      {
        "id": "preventa-1",
        "offering_id": "...",
        "slug": "preventa-1",
        "label": "Preventa 1",
        "section": "general",
        "price": 10000,
        "currency": "CLP",
        "badge_label": "Early bird",
        "maps_to_tier": "general",
        "maps_to_type": "general"
      },
      {
        "id": "vip-general",
        "label": "VIP General",
        "section": "vip",
        "price": 35000,
        "maps_to_tier": "vip",
        "maps_to_type": "vip"
      }
    ]
  }
}
```

**Flutter mapping:** `TicketOfferingEntity.id` ← `slug` or `id`; price from `price`.

---

## Venue layout

**`GET /events/:eventId/venue-layout`**

```json
{
  "success": true,
  "data": {
    "venue_id": "...",
    "event_id": "...",
    "name": "BICENTENNIAL PARK - Main Hall",
    "dimensions": { "width_meters": 36, "height_meters": 18 },
    "dimensions_label": "36m × 18m",
    "zones": [
      {
        "id": "vip-1",
        "zone_id": "...",
        "name": "VIP 1",
        "type": "vip_table_zone",
        "kind": "vip_table_zone",
        "position": { "x": 10, "y": 20 },
        "size": { "width": 25, "height": 30 },
        "color": "green",
        "status": "available",
        "table_capacity": 10,
        "available_tables": 6,
        "total_tables": 8,
        "selectable": true,
        "is_selectable": true
      }
    ]
  }
}
```

**Zone types:** `vip_table_zone` | `vip_premium_zone` | `stage` | `general_floor`  
**Non-selectable:** `stage`, `dance-floor` (`selectable: false`)

---

## Zone tables

**`GET /events/:eventId/zones/:zoneId/tables`**

`:zoneId` = external id (`vip-1`) **or** internal `zone_id`.

```json
{
  "success": true,
  "data": {
    "zone_id": "vip-1",
    "zone_name": "VIP 1",
    "table_capacity": 10,
    "tables": [
      {
        "id": "table-vip-1-m1",
        "table_id": "...",
        "number": 1,
        "label": "M1",
        "zone_id": "vip-1",
        "status": "available",
        "position": { "x": 5, "y": 5 },
        "price": 320000,
        "currency": "CLP",
        "includes": {
          "people": 10,
          "bottles": 2,
          "bar_vouchers": 20,
          "extras": []
        },
        "is_premium": false,
        "locked_until": null,
        "locked_by_me": false
      }
    ]
  }
}
```

**Table `status` (API):** `available` | `locked` | `selected` | `sold` | `premium`  
- `selected` = locked by **current user**  
- `locked` = held by someone else

---

## Table lock (10 minutes)

### Reserve before checkout

**`POST /events/:eventId/tables/:tableId/lock`**  
Auth: **Bearer required**

`:tableId` = external id (`table-vip-1-m1`) or internal `table_id`.

```json
{
  "success": true,
  "data": {
    "lock_id": "...",
    "table_id": "...",
    "expires_at": "2026-06-08T12:40:00.000Z",
    "expires_in_seconds": 600,
    "table": { "...": "..." }
  }
}
```

**Flutter flow:**
1. User taps **Reserve** → call `POST lock`
2. Store `expires_at` on session → show countdown on summary
3. On expiry → pop to table screen + refresh tables
4. On abandon → `DELETE lock`

### Release

**`DELETE /events/:eventId/tables/:tableId/lock`**

---

## Realtime availability (polling)

**`GET /events/:eventId/tables/availability/realtime`**

Poll every 15–30s on floor plan / table screens.

```json
{
  "success": true,
  "data": {
    "event_id": "...",
    "updated_at": "2026-06-08T12:30:00.000Z",
    "zones": [
      {
        "zone_id": "vip-1",
        "available_tables": 6,
        "locked_tables": 1,
        "sold_tables": 1,
        "tables": [{ "id": "table-vip-1-m1", "label": "M1", "status": "available" }]
      }
    ]
  }
}
```

---

## Checkout

**`POST /events/:eventId/checkout`**  
Auth: **Bearer required**

Mock payment is **on** by default (`CHECKOUT_MOCK_PAYMENT=true`). Service fee **5%** included in `total_amount` (not shown as separate line to end user if product hides breakdown).

### A — General tickets (single offering)

```json
{
  "offering_id": "preventa-1",
  "quantity": 2
}
```

Or legacy:

```json
{
  "quantity": 2,
  "tier": "general",
  "type": "general"
}
```

### B — Multiple offerings

```json
{
  "items": [
    { "offering_id": "preventa-1", "quantity": 2 },
    { "offering_id": "vip-general", "quantity": 1 }
  ]
}
```

### C — VIP table

1. `POST .../tables/:tableId/lock` first  
2. Checkout:

```json
{
  "table_id": "table-vip-1-m1",
  "zone_id": "vip-1",
  "tier": "vip",
  "type": "vip_table"
}
```

Creates order with **table capacity** slots (e.g. 10) for guest assignment.

### Response

```json
{
  "success": true,
  "data": {
    "order_id": "...",
    "event_id": "...",
    "event_title": "URBAN NIGHT LIVE",
    "quantity": 10,
    "subtotal_amount": 320000,
    "service_fee_rate": 0.05,
    "service_fee_amount": 16000,
    "total_amount": 336000,
    "currency": "CLP",
    "status": "paid",
    "tier": "vip",
    "type": "vip_table",
    "table_id": "...",
    "zone_id": "...",
    "ticket_id": "...",
    "qr_unlock_at": "2026-11-21T03:00:00.000Z",
    "seat_label": "VIP M1",
    "available_to_assign": 9,
    "payment_reference": "mock_abc123"
  }
}
```

**Post-purchase QR:**
- Use `ticket_id` → `GET /users/me/tickets/:ticket_id/qr` (see [FLUTTER_TICKETS_API.md](./FLUTTER_TICKETS_API.md))
- `qr_unlock_at` = when QR unlocks (event day 00:00 local)

---

## Flutter integration checklist

| Screen | Replace mock with |
|--------|-------------------|
| `TicketSelectionScreen` | `GET /events/:id/ticket-types` |
| `FloorPlanScreen` | `GET /events/:id/venue-layout` |
| `TableSelectionScreen` | `GET /events/:id/zones/:zoneId/tables` |
| Reserve button | `POST .../lock` |
| `PurchaseSummaryScreen` | `POST .../checkout` with offerings or `table_id` |
| Success → QR | `ticket_id` from checkout + `GET .../qr` |

**Repository suggestion:**

```
lib/features/vip_venue/data/
  datasources/vip_venue_remote_datasource.dart
  repositories/vip_venue_repository_impl.dart
  models/...
```

---

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `EVENT_NOT_FOUND` | 404 | Event missing or not published |
| `VENUE_LAYOUT_NOT_FOUND` | 404 | No floor plan for event |
| `VENUE_ZONE_NOT_FOUND` | 404 | Invalid zone |
| `VENUE_TABLE_NOT_FOUND` | 404 | Invalid table |
| `TICKET_OFFERING_NOT_FOUND` | 404 | Invalid offering |
| `TABLE_NOT_AVAILABLE` | 409 | Table sold |
| `TABLE_LOCKED` | 409 | Held by another user |
| `TABLE_LOCK_REQUIRED` | 409 | Checkout without active lock |
| `PAYMENT_METHOD_REQUIRED` | 422 | Real payments enabled, no card |

---

## Seed data

Chile published events are seeded with offerings + YouFest-style layout:

```bash
npm run db:seed:vip
```

Zones: `vip-1`, `vip-dj`, `vip-2`, `stage`, `dance-floor`  
Tables: M1–M8 (VIP 1), D1–D6 (VIP DJ), M1–M8 (VIP 2)

---

*End of VIP Venue API doc*
