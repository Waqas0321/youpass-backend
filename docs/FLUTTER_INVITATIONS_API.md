# Flutter — Invitations API

**Base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Auth:** `Authorization: Bearer <access_token>`

Backend implements the [Invitations API Specification](./INVITATIONS_API.md). Set `useInvitationsMockData = false` in Flutter.

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/invitations` | List my invitations |
| GET | `/users/me/invitations` | Alias for list |
| GET | `/invitations/:id` | Invitation detail |
| POST | `/invitations/:id/confirm` | Confirm attendance |
| POST | `/invitations/:id/reject` | Reject invitation |
| GET | `/invitations/:id/ticket` | QR + entry code |
| GET | `/users/me/invitations/summary` | Drawer badge count |
| GET | `/users/me/payment-methods` | Saved cards |
| POST | `/users/me/payment-methods` | Save card (courtesy flow) |

---

## List invitations

```
GET /invitations
```

Optional query: `status`, `tier`, `type`, `search`

```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "id": "...",
        "event_id": "...",
        "event_title": "YouFest 2026",
        "location": "Centro Eventos Hilaria, Concepción",
        "date_time_label": "Sat 4 Jul · 22:00",
        "image_url": "https://...",
        "tier": "vip",
        "type": "courtesy",
        "status": "pending",
        "requires_payment_method": true,
        "entry_code": null,
        "qr_payload": null
      }
    ],
    "meta": {
      "total": 3,
      "pending_count": 2,
      "confirmed_count": 1
    }
  }
}
```

Client hides `status: rejected` items.

---

## Drawer badge

```
GET /users/me/invitations/summary
```

```json
{
  "success": true,
  "data": {
    "pending_count": 2,
    "new_count": 2,
    "total_count": 3
  }
}
```

---

## Confirm / reject

```
POST /invitations/:id/confirm
POST /invitations/:id/reject
```

Body: `{}` or omit body. **Do not** send `Content-Type: application/json` with null body — use headers only, or send `{}`.

After confirm → call `GET /invitations/:id/ticket` for QR screen.

---

## Ticket / QR

```
GET /invitations/:id/ticket
```

Success when QR unlocked (event day 00:00 in event timezone):

```json
{
  "success": true,
  "data": {
    "invitation_id": "...",
    "event_title": "Festival Verano 2026",
    "date_time_label": "Thu 15 May · 22:00",
    "location": "Club Amanda, Santiago",
    "entry_code": "8F7A2B",
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
    "details": { "unlock_at": "2026-05-15T03:00:00.000Z" }
  }
}
```

---

## Payment method (before courtesy confirm)

```
POST /users/me/payment-methods
Content-Type: application/json

{
  "card_number": "4111111111111111",
  "expiry": "12/28",
  "cvv": "123",
  "cardholder_name": "Waqas Akhtar"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "pm_abc123",
    "brand": "visa",
    "last_four": "1111",
    "is_default": true
  }
}
```

CVV is **not** stored — MVP tokenizes to `pm_*` id only.

---

## Error codes

| Code | HTTP |
|------|------|
| `INVITATION_NOT_FOUND` | 404 |
| `INVITATION_FORBIDDEN` | 403 |
| `PAYMENT_METHOD_REQUIRED` | 422 |
| `INVITATION_ALREADY_CONFIRMED` | 409 |
| `INVITATION_EXPIRED` | 409 |
| `QR_LOCKED` | 423 |
| `SESSION_INVALID` | 401 |

---

## Test data

Seeded for the first active user (e.g. Waqas Akhtar):

1. **YouFest 2026** — pending, courtesy VIP, requires payment method  
2. **Concierto X** — pending, general  
3. **Festival Verano 2026** — confirmed VIP, QR available (event day passed)

---

## Related

- [INVITATIONS_API.md](./INVITATIONS_API.md) — Full specification
- [FLUTTER_SESSION_TOKEN_FIX.md](./FLUTTER_SESSION_TOKEN_FIX.md) — Auth token handling
