# YouPass — Admin Panel API Reference (Production)

**Base URL:** `https://youpass-backend.vercel.app/api/v1`

**Admin panel (production):** https://youpass-backend.vercel.app/admin/

**Admin React source:** `admin/` folder (Vite) — built into `public/admin/` on deploy.

---

## Authentication

All admin routes require:

```http
X-Admin-Key: <ADMIN_API_KEY>
```

Also accepted: `X-Admin-Api-Key`, `X-System-Api-Key`

Set in Vercel: **`ADMIN_API_KEY`**

Producer-scoped routes (invitations) also send:

```http
X-Producer-Id: <producer_mongodb_id>
```

**Response shape:** `{ "success": true, "data": { ... } }`  
**Errors:** `{ "success": false, "error": { "code": "...", "message": "..." } }`

---

## 1. Dashboard overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/overview` | Counts: users, events, producers, etc. |
| GET | `/admin/producers` | List producers |
| GET | `/admin/users` | List users |
| GET | `/admin/events` | List all events |

---

## 2. Events CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/events` | Create event |
| PATCH | `/admin/events/:eventId` | Update event |
| DELETE | `/admin/events/:eventId` | Delete event |

### Create event body

Use either a reusable **`venue_id`** or inline venue fields:

```json
{
  "title": "Urban Night Live",
  "starts_at": "2026-11-21T20:00:00.000Z",
  "venue_id": "VENUE_MONGODB_ID",
  "event_type": "concerts",
  "status": "published"
}
```

Or without `venue_id`:

```json
{
  "title": "Urban Night Live",
  "starts_at": "2026-11-21T20:00:00.000Z",
  "venue_name": "Bicentennial Park",
  "city": "Santiago",
  "country_code": "CL",
  "event_type": "concerts",
  "status": "published"
}
```

---

## 3. Physical venues (reusable catalog)

Stores where events are held — **reused across multiple events**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/venues` | List venues (`?country=CL&city=Santiago&q=club`) |
| POST | `/admin/venues` | Create venue |
| GET | `/admin/venues/:id` | Get venue |
| PATCH | `/admin/venues/:id` | Update venue |
| DELETE | `/admin/venues/:id` | Delete (blocked if linked to events) |

**Flutter read-only:** `GET /venues` · `GET /venues/:id`

### POST venue body

```json
{
  "name": "Club Amanda - Main Hall",
  "address": "Av. Providencia 1234",
  "city": "Santiago",
  "country": "CL",
  "dimensions": {
    "width_meters": 40,
    "height_meters": 30
  }
}
```

### Response

```json
{
  "id": "...",
  "name": "Club Amanda - Main Hall",
  "address": "Av. Providencia 1234",
  "city": "Santiago",
  "country": "CL",
  "dimensions": { "width_meters": 40, "height_meters": 30 },
  "created_at": "2026-06-03T12:00:00.000Z",
  "updated_at": "2026-06-03T12:00:00.000Z"
}
```

**DB table:** `venues`

---

## 4. Ticket offerings (`ticket_types`)

Per-event ticket products (Preventa, VIP General, etc.).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/events/:eventId/ticket-offerings` | List offerings |
| POST | `/admin/events/:eventId/ticket-offerings` | Create offering |
| PATCH | `/admin/events/:eventId/ticket-offerings/:offeringId` | Update |
| DELETE | `/admin/events/:eventId/ticket-offerings/:offeringId` | Delete |

### Create offering body

```json
{
  "type": "early_bird",
  "name": "Early Bird",
  "price": 10000,
  "display_order": 1,
  "stock_total": 500,
  "stock_remaining": 500,
  "sale_start_at": "2026-01-01T00:00:00.000Z",
  "sale_end_at": "2026-06-01T00:00:00.000Z",
  "status": "active"
}
```

**Types:** `early_bird` · `preventa_2` · `preventa_3` · `general` · `vip_general` (one per event)  
**Status:** `active` · `sold_out` · `paused` · `closed`  
**Guest app:** stock fields are **admin-only** — Flutter uses `is_sold_out` / `is_selectable`.

**DB table:** `event_ticket_offerings`  
**Flutter reads:** `GET /events/:eventId/ticket-types`

---

## 4. Venue layout (`venues` → zones → tables)

Configure VIP floor plan per event.

### Layout

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/events/:eventId/venue-layout` | Get full layout + zones + tables |
| PUT | `/admin/events/:eventId/venue-layout` | Create/update layout shell |
| DELETE | `/admin/events/:eventId/venue-layout` | Delete entire layout |

### PUT layout body

Link to a physical venue (dimensions default from venue):

```json
{
  "venue_id": "VENUE_MONGODB_ID",
  "table_lock_minutes": 10
}
```

Or define inline:

```json
{
  "venue_name": "Club Main Floor",
  "width_meters": 40,
  "height_meters": 30,
  "table_lock_minutes": 10
}
```

**DB table:** `event_venue_layouts`

### Zones

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/events/:eventId/venue-layout/zones` | Add zone |
| PATCH | `/admin/events/:eventId/venue-layout/zones/:zoneId` | Update zone |
| DELETE | `/admin/events/:eventId/venue-layout/zones/:zoneId` | Delete zone |

### POST zone body

```json
{
  "external_id": "zone-vip-1",
  "name": "VIP Tables",
  "kind": "vip_table_zone",
  "status": "available",
  "position_x": 10,
  "position_y": 5,
  "size_width": 20,
  "size_height": 15,
  "color": "#E5A906",
  "capacity_per_table": 10,
  "is_selectable": true,
  "display_order": 1
}
```

**DB table:** `venue_zones`  
**`kind` values:** `vip_table_zone` · `vip_premium_zone` · `stage` · `general_floor`

### Tables

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/events/:eventId/venue-layout/zones/:zoneId/tables` | Add table |
| PATCH | `/admin/events/:eventId/venue-layout/zones/:zoneId/tables/:tableId` | Update table |
| DELETE | `/admin/events/:eventId/venue-layout/zones/:zoneId/tables/:tableId` | Delete table |

### POST table body

```json
{
  "external_id": "table-vip-2-m2",
  "number": 2,
  "label": "M2",
  "status": "available",
  "position": { "x": 12, "y": 8 },
  "price": 320000,
  "capacity": 10,
  "includes": {
    "bottles": 2,
    "bar_vouchers": 20,
    "extras": []
  }
}
```

**DB table:** `venue_tables` — per-event rows with `event_id`, `zone_id`, `position` JSON, `includes` JSON, lock/sold fields (`locked_by_user_id`, `locked_until`, `sold_at`, `sold_to_user_id`).  
**Status enum:** `available` · `locked` · `reserved` · `sold`  
**Flutter reads:** `GET /events/:eventId/venue-layout` · `GET .../zones/:zoneId/tables`

---

## 5. Invitation settings (per event)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/events/:eventId/invitation-settings` | Free / guaranteed / discount settings |
| PATCH | `/admin/events/:eventId/invitation-settings` | Update settings |

### PATCH body (example)

```json
{
  "allow_free": true,
  "allow_guaranteed": true,
  "allow_discount": true,
  "free_cancellation_days": 1,
  "guaranteed_cancellation_days": 3,
  "discount_cancellation_days": 1,
  "discount_percentage": 20,
  "enable_waiting_list": true,
  "waitlist_offer_hours": 24,
  "courtesy_slots_total": 50
}
```

---

## 6. Waitlist dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/events/:eventId/waitlist` | Queue, active offer, history |

---

## 7. Home banners (main carousel)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config/home-banners/all` | List all banners (admin) |
| POST | `/config/home-banners` | Create banner |
| PATCH | `/config/home-banners/:id` | Update banner |
| DELETE | `/config/home-banners/:id` | Delete banner |

**Flutter reads:** `GET /config/home-banners/carousel` (public, filtered)

### POST banner body

```json
{
  "title": "Summer Festival",
  "subtitle": "Tickets on sale",
  "image_url": "https://...",
  "tap_action_type": "event_detail",
  "event_id": "...",
  "display_starts_at": "2026-06-01T00:00:00.000Z",
  "display_ends_at": "2026-12-31T23:59:59.000Z",
  "country_codes": ["CL"],
  "priority": 10,
  "is_active": true
}
```

---

## 8. Event categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config/event-categories/all` | All categories (admin) |
| POST | `/config/event-categories` | Create category |
| PATCH | `/config/event-categories/:id` | Update category |

**Flutter reads:** `GET /config/event-categories` (active only)

---

## 9. Global config

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config/invitations` | Global invitation expiry rules |
| PATCH | `/config/invitations` | Update `{ "expiry_days": 3 }` |
| GET | `/config/event-listing` | Home listing algorithm weights |
| PATCH | `/config/event-listing` | Update weights / page size |

---

## 10. Support FAQs (admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/support/admin/config` | Support config |
| PATCH | `/support/admin/config` | Update support config |
| GET | `/support/admin/faqs` | List FAQs |
| POST | `/support/admin/faqs` | Create FAQ |
| PATCH | `/support/admin/faqs/:id` | Update FAQ |
| DELETE | `/support/admin/faqs/:id` | Delete FAQ |

**Flutter reads:** `GET /support/faqs` · `GET /support/contact-info`

---

## 11. Producer invitations (admin / producer portal)

Requires **`X-Producer-Id`** header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/producer/invitations/stats` | Revenue & acceptance stats |
| GET | `/producer/invitations` | List sent invitations |
| GET | `/producer/invitations/alerts` | Alerts |
| POST | `/producer/invitations` | Send invitation |
| GET | `/producer/invitations/freed-slots` | Freed slots |
| POST | `/producer/invitations/reinvite` | Reinvite |
| GET | `/producer/invitations/waitlist` | Producer waitlist view |
| GET | `/producer/invitations/post-event-report` | Post-event report |
| PATCH | `/producer/events/:eventId/invitation-settings` | Producer event settings |

---

## 12. System jobs (cron / manual)

Requires admin key.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/system/invitations/release-expired` | Release expired invitations |
| POST | `/system/invitations/send-reminders` | Send GP reminders |
| POST | `/system/invitations/post-event-charges` | Post-event charges |
| POST | `/system/invitations/process-waitlist-offers` | Process waitlist offers |

---

## 13. Door validation (staff app)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/door/validate` | Validate QR at entry |

```http
X-Admin-Api-Key: <ADMIN_API_KEY>
Content-Type: application/json

{ "qr_payload": "..." }
```

---

## 14. Webhooks (payment providers)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/klap` | Klap payment callback (Chile) |
| POST | `/webhooks/stripe` | Stripe payment callback (LATAM) |

Configured in Klap/Stripe dashboards — not called from admin UI.

---

## Data model map (admin configures → Flutter consumes)

| Admin configures | DB collection | Flutter endpoint |
|------------------|---------------|------------------|
| **Venue (physical)** | `venues` | `GET /venues` |
| Event | `events` | `GET /events/:id` |
| Ticket offerings | `event_ticket_offerings` | `GET /events/:id/ticket-types` |
| Venue layout | `event_venue_layouts` | `GET /events/:id/venue-layout` |
| Zones | `venue_zones` | inside venue-layout |
| Tables | `venue_tables` | `GET .../zones/:zoneId/tables` |
| Home banners | `home_banner_slides` | `GET /config/home-banners/carousel` |
| Event categories | `event_types` / categories | `GET /config/event-categories` |

---

## Admin panel client reference

TypeScript API client: `admin/src/api/client.ts` — mirrors all endpoints above.

**Admin UI screens:** Dashboard · Events (with catalog venue picker + floor plan link) · **Venues** (physical catalog CRUD) · Categories · Banners · Invitations · Event settings · Waitlist · System jobs

### Example curl

```bash
export ADMIN_KEY="your-vercel-admin-api-key"

curl -s -H "X-Admin-Key: $ADMIN_KEY" \
  https://youpass-backend.vercel.app/api/v1/admin/overview

curl -s -H "X-Admin-Key: $ADMIN_KEY" \
  https://youpass-backend.vercel.app/api/v1/admin/events

curl -s -H "X-Admin-Key: $ADMIN_KEY" \
  https://youpass-backend.vercel.app/api/v1/admin/events/EVENT_ID/venue-layout
```

---

## Environment variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `ADMIN_API_KEY` | Admin panel + door validator auth |
| `DATABASE_URL` | MongoDB |
| `JWT_SECRET` | User sessions |
| `TWILIO_*` | WhatsApp OTP |
| `KLAP_*` / `STRIPE_*` | Payments |
| `CLOUDINARY_*` | Profile photos |
| `CHECKOUT_MOCK_PAYMENT` | `true` = skip real payment in dev |

See `.env.example` for full list.

---

## Related docs

| Doc | Audience |
|-----|----------|
| [FLUTTER_API_DEPLOYED.md](./FLUTTER_API_DEPLOYED.md) | Flutter — all consumer APIs |
| [FLUTTER_VIP_VENUE_API.md](./FLUTTER_VIP_VENUE_API.md) | Venue map Flutter integration |
| [LATAM_MULTI_COUNTRY_API.md](./LATAM_MULTI_COUNTRY_API.md) | Multi-country backend reference |

---

*Production — `https://youpass-backend.vercel.app/api/v1`*
