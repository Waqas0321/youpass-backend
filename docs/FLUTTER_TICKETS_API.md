# Flutter — My Tickets API

**Base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Auth:** `Authorization: Bearer <access_token>`

My Tickets lists **confirmed invitation tickets** (purchase tickets will use the same endpoints later).

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me/tickets/upcoming` | Upcoming / active tickets |
| GET | `/users/me/tickets/past` | Past events + statistics |
| GET | `/users/me/tickets/yearly-summary` | Annual attended summary (Past tab header) |
| GET | `/users/me/tickets/:id` | Ticket detail |
| GET | `/users/me/tickets/:id/qr` | QR screen (same as invitations ticket) |
| GET | `/tickets/:id` | Alias — ticket detail |
| GET | `/tickets/:id/qr` | Alias — QR screen |

Favorites heart on Past cards uses existing **[FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md)** favorites endpoints — not duplicated here.

---

## Upcoming tickets

```
GET /users/me/tickets/upcoming
```

Optional query: `page`, `limit` (default 20, max 50)

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": "invitation_id",
        "event_id": "...",
        "event_title": "Summer Festival 2026",
        "location": "Club Amanda, Santiago",
        "date_time_label": "Sat 15 May • 22:00",
        "image_url": "https://...",
        "status": "active",
        "ticket_type_label": "General",
        "ticket_count": 1,
        "tier": "general",
        "type": "general",
        "origin": "invitation",
        "invitation_id": "...",
        "producer": { "id": "...", "name": "El Tebo" },
        "event_type": { "slug": "parties", "name": "Parties" },
        "assigned_slot": null,
        "is_favorite": false,
        "can_view_qr": false,
        "can_assign_tickets": false,
        "qr_status": "locked",
        "entry_code": "YD9ETK",
        "statistics": null
      }
    ],
    "meta": {
      "total": 3,
      "page": 1,
      "limit": 20,
      "total_pages": 1,
      "active_count": 3
    }
  }
}
```

### Upcoming UI mapping

| UI | API field |
|----|-----------|
| ● ACTIVE badge | `status === "active"` |
| Event title | `event_title` |
| Date · time | `date_time_label` |
| Venue | `location` |
| General · 1 ticket | `ticket_type_label` + `ticket_count` |
| VIEW QR button | Call `GET .../tickets/:id/qr` when `can_view_qr === true` |
| ASSIGN TICKETS | Show when `can_assign_tickets === true` (future purchase flow) |

### Ticket status values

| status | Meaning |
|--------|---------|
| `active` | Valid, event not ended, not scanned yet |
| `validated` | Scanned at door, event still within 24h window |

---

## Past tickets

```
GET /users/me/tickets/past
```

Query params:

| Param | Example | Description |
|-------|---------|-------------|
| `search` | `youfest` | Event name, venue, city, or producer |
| `event_type` | `parties` | Filter: `parties`, `concerts`, `bar` |
| `status` | `attended` | `attended`, `not_attended`, `cancelled` |
| `page` | `1` | Page number |
| `limit` | `20` | Page size |

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": "...",
        "event_title": "YouFest 2026",
        "location": "Centro Eventos Hilaria, Concepción",
        "date_time_label": "Sat 4 Jul • 22:00",
        "image_url": "https://...",
        "status": "validated",
        "is_favorite": true,
        "statistics": {
          "entry_time": "22:41",
          "entry_at": "2026-07-04T22:41:00.000Z",
          "consumption_count": 6,
          "stay_minutes": 314,
          "stay_label": "5h 14m"
        }
      }
    ],
    "meta": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "total_pages": 1,
      "attended_count": 3
    }
  }
}
```

### Past filters (chips)

| Chip | Query |
|------|-------|
| All | no `event_type` |
| Parties | `event_type=parties` |
| Concerts | `event_type=concerts` |
| Bar | `event_type=bar` |

### Statistics block

Shown when `status === "validated"` and `statistics` is not null.

| UI | API field |
|----|-----------|
| Entry 22:41 | `statistics.entry_time` |
| Consumption 6 | `statistics.consumption_count` |
| Stay 5h 14m | `statistics.stay_label` |

If `consumption_count` or `stay_label` is null, hide that metric (Party Mode / exit scan not available yet).

### Favorite heart

Use existing favorites API — do **not** send favorite state with ticket PATCH:

```
POST   /users/me/favorites/events/:eventId
DELETE /users/me/favorites/events/:eventId
```

Toggle heart using `is_favorite` from the ticket list, then call favorites API.

---

## Yearly summary (Past tab header)

```
GET /users/me/tickets/yearly-summary
```

```json
{
  "success": true,
  "data": {
    "year": 2026,
    "events_attended": 3,
    "current_category": "gold",
    "favorite_producer": {
      "name": "El Tebo",
      "events_attended": 2
    }
  }
}
```

---

## View QR

```
GET /users/me/tickets/:id/qr
```

Same response as `GET /invitations/:id/ticket`. Use **invitation id** as ticket `id`.

Success when QR unlocked:

```json
{
  "success": true,
  "data": {
    "invitation_id": "...",
    "event_title": "Santiago Live Tonight",
    "date_time_label": "Wed 3 Jun • 20:00",
    "location": "Teatro Coliseo, Santiago",
    "entry_code": "YD9ETK",
    "qr_payload": "ticketId.eventId.signature",
    "qr_status": "available",
    "ticket_type_label": "VIP",
    "instruction": "Show this code at the entrance to access the event"
  }
}
```

Locked (HTTP **423**):

```json
{
  "success": false,
  "error": {
    "code": "QR_LOCKED",
    "message": "Your QR will be available from 00:00 on the day of the event",
    "details": { "unlock_at": "2026-06-03T03:00:00.000Z" }
  }
}
```

---

## Flutter integration

### My Tickets screen

```dart
// Upcoming tab
final upcoming = await http.get(
  Uri.parse('$apiBaseUrl/users/me/tickets/upcoming'),
  headers: authHeaders,
);

// Past tab
final past = await http.get(
  Uri.parse('$apiBaseUrl/users/me/tickets/past').replace(
    queryParameters: {
      if (search.isNotEmpty) 'search': search,
      if (eventType != null) 'event_type': eventType,
    },
  ),
  headers: authHeaders,
);
```

### View QR flow

```dart
Future<void> openQr(String ticketId) async {
  final response = await http.get(
    Uri.parse('$apiBaseUrl/users/me/tickets/$ticketId/qr'),
    headers: authHeaders,
  );

  if (response.statusCode == 423) {
    // Show "QR not available yet" dialog
    return;
  }

  final data = jsonDecode(response.body)['data'];
  // Render QR from data['qr_payload'], show data['entry_code']
}
```

### Data sources

| Screen | Endpoint |
|--------|----------|
| Invitations (pending) | `GET /invitations` |
| My Tickets → Upcoming | `GET /users/me/tickets/upcoming` |
| My Tickets → Past | `GET /users/me/tickets/past` |
| Favorite heart | `POST/DELETE /users/me/favorites/events/:eventId` |

---

## Error codes

| Code | HTTP |
|------|------|
| `TICKET_NOT_FOUND` | 404 |
| `QR_LOCKED` | 423 |
| `SESSION_INVALID` | 401 |

---

## Related

- [FLUTTER_INVITATIONS_API.md](./FLUTTER_INVITATIONS_API.md) — pending invitations, confirm/reject
- [FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md) — favorites, event detail
