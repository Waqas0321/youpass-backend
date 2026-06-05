# Flutter — Guest Ticket Assignment & Invitations

**Base URL:** `https://youpass-backend.vercel.app/api/v1`

This doc covers the **client flow**: purchase tickets → assign to contacts → WhatsApp from YouPass → guest claims → accept/reject in Invitations.

See also:
- [FLUTTER_TICKETS_API.md](./FLUTTER_TICKETS_API.md) — My Tickets list, QR
- [FLUTTER_INVITATIONS_API.md](./FLUTTER_INVITATIONS_API.md) — Producer invitations (VIP/courtesy)

---

## Flow overview

```
Buyer                          Backend                         Guest
  │                               │                              │
  ├── POST /events/:id/checkout ─►│ creates order + slots        │
  ├── GET .../assignments ───────►│ Entrada 1..N                 │
  ├── POST .../slots/:id/assign ─►│ WhatsApp (Twilio Business) ─►│
  │   (name + phone from contacts)│                              │
  │                               │◄── GET /invitations/claim/:token
  │                               │◄── register/login (same phone)
  │                               │    auto-links invitation      │
  │                               │◄── POST /invitations/:id/confirm
```

**Contact picker** is Flutter-only (`flutter_contacts`). The app sends `guest_name` + `guest_phone` + `country_code` to the API. The user never sends WhatsApp manually.

---

## 1. Purchase tickets (checkout)

```
POST /events/:eventId/checkout
Authorization: Bearer <token>
```

```json
{
  "quantity": 10,
  "tier": "vip",
  "type": "general",
  "payment_method_id": "pm_abc123"
}
```

| Field | Notes |
|-------|-------|
| `quantity` | 1–50 |
| `tier` | `general` \| `vip` |
| `payment_method_id` | Required when `CHECKOUT_MOCK_PAYMENT=false` |

**MVP / dev:** `CHECKOUT_MOCK_PAYMENT=true` (default) skips real payment.

**Response:**

```json
{
  "success": true,
  "data": {
    "order_id": "...",
    "event_title": "Santiago Live Tonight",
    "quantity": 10,
    "total_amount": 480000,
    "currency": "CLP",
    "available_to_assign": 9
  }
}
```

Slot 1 is the **buyer's own ticket** (confirmed immediately). Slots 2–N are assignable.

---

## 2. Assign tickets screen

```
GET /users/me/ticket-orders/:orderId/assignments
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "order_id": "...",
    "event_title": "Santiago Live Tonight",
    "quantity": 10,
    "available_count": 9,
    "pending_count": 0,
    "can_assign_in_parts": true,
    "slots": [
      {
        "id": "slot_id",
        "slot_number": 1,
        "label": "Entrada 1",
        "status": "owner",
        "can_send": false,
        "can_cancel": false,
        "can_resend": false
      },
      {
        "id": "slot_id_2",
        "slot_number": 2,
        "label": "Entrada 2",
        "status": "available",
        "guest_name": null,
        "guest_phone": null,
        "can_send": true,
        "can_cancel": false,
        "can_resend": false
      }
    ]
  }
}
```

### Slot status (UI)

| status | Meaning | UI |
|--------|---------|-----|
| `owner` | Buyer's ticket | No assign actions |
| `available` | Not sent yet | Show empty form + Enviar entrada |
| `pending` | WhatsApp sent, guest hasn't accepted | PENDIENTE badge |
| `claimed` | Guest accepted | Done |

---

## 3. Send invitation (Enviar entrada)

```
POST /users/me/ticket-orders/:orderId/slots/:slotId/assign
Authorization: Bearer <token>
```

```json
{
  "guest_name": "Carla Pérez",
  "guest_phone": "987654321",
  "country_code": "CL"
}
```

**Backend sends WhatsApp** from your official YouPass number (Twilio WhatsApp Business). Message includes claim link and steps.

**Response:**

```json
{
  "success": true,
  "data": {
    "slot": { "status": "pending", "guest_name": "Carla Pérez", ... },
    "claim_url": "https://youpass.app/claim/abc123...",
    "message": "Invitation sent via WhatsApp from YouPass"
  }
}
```

**Errors:**

| Code | HTTP | Meaning |
|------|------|---------|
| `WHATSAPP_SEND_FAILED` | 502 | Twilio send failed; slot rolled back |
| `CANNOT_ASSIGN_TO_SELF` | 422 | Buyer's own phone |
| `TICKET_SLOT_NOT_AVAILABLE` | 409 | Already assigned |

### Cancel assignment (Cancelar entrada)

```
DELETE /users/me/ticket-orders/:orderId/slots/:slotId/assign
```

### Resend WhatsApp

```
POST /users/me/ticket-orders/:orderId/slots/:slotId/resend
```

---

## 4. Guest claim link (deep link)

Public — no auth:

```
GET /invitations/claim/:token
```

Use when app opens from WhatsApp link (`APP_CLAIM_BASE_URL/{token}`).

```json
{
  "success": true,
  "data": {
    "event_title": "Santiago Live Tonight",
    "invited_by": "Juan Pérez",
    "guest_name": "Carla Pérez",
    "steps": [
      "Download the YouPass app",
      "Register or log in with the invited phone number",
      "Open Invitations and accept your ticket"
    ]
  }
}
```

After **register** or **login** with the invited phone, the API returns `linked_invitations` count and the invite appears under **Invitations**.

---

## 5. Guest — Invitations menu (accept / reject)

Same as producer invitations:

```
GET  /invitations                    — list (includes guest + producer)
GET  /invitations/:id                — detail
POST /invitations/:id/confirm        — accept → ticket created
POST /invitations/:id/reject         — reject → slot freed for buyer
```

Guest invitations include:

```json
{
  "source": "guest",
  "invited_by": { "name": "Juan Pérez", "role": "guest" }
}
```

Filter guest-only:

```
GET /invitations?source=guest
```

---

## 6. My Tickets — assign button

Upcoming tickets from a purchase include:

```json
{
  "can_assign_tickets": true,
  "ticket_order_id": "order_id",
  "assignable_count": 9,
  "origin": "purchase"
}
```

Navigate to assign screen (any of these work):

```
GET /users/me/ticket-orders/{ticket_order_id}/assignments
GET /users/me/tickets/{ticket_id}/assignments
```

Use `ticket_order_id` from My Tickets when available, or the ticket `id` — the API resolves both.

---

## Flutter contact picker

```dart
import 'package:flutter_contacts/flutter_contacts.dart';

Future<void> pickContact(void Function(String name, String phone) onSelected) async {
  if (!await FlutterContacts.requestPermission(readonly: true)) return;
  final contact = await FlutterContacts.openExternalPick();
  if (contact == null) return;
  final phone = contact.phones.firstOrNull?.number ?? '';
  onSelected(contact.displayName, phone);
}
```

Then POST assign with parsed `country_code` + national number.

---

## Environment variables (backend — your team)

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Production | Twilio account |
| `TWILIO_AUTH_TOKEN` | Production | Twilio auth |
| `TWILIO_WHATSAPP_FROM` | Production | Official WhatsApp sender (E.164) |
| `TWILIO_MOCK` | **Must be `false` on Vercel** (same as OTP) |
| `TWILIO_WHATSAPP_INVITATION_CONTENT_SID` | Recommended prod — approved invite template |
| `TWILIO_WHATSAPP_OTP_CONTENT_SID` | Optional fallback — reuse OTP template for invites |

Invitations use the **same Twilio WhatsApp API path as OTP**. If OTP arrives but invites do not, check the API response:

```json
"delivery_mode": "mock"   → TWILIO_MOCK still true on server
"delivery_mode": "live"   → Twilio accepted; guest number must have WhatsApp + be verified on trial
```
| `APP_CLAIM_BASE_URL` | Yes | e.g. `https://youpass.app/claim` |
| `CHECKOUT_MOCK_PAYMENT` | Dev | `true` = skip Stripe/Klap (default) |

### Still required from client

1. **WhatsApp Business** account verified with Twilio (or Meta Cloud API migration later)
2. **Approved WhatsApp template** for ticket invitations (required for production outbound messages outside 24h session window)
3. **Real payments** — Stripe/Klap integration when `CHECKOUT_MOCK_PAYMENT=false`
4. **App deep links** — configure `youpass.app/claim/*` → open Flutter app
5. **iOS/Android contacts permission** strings in Flutter app

---

## Error codes summary

| Code | Description |
|------|-------------|
| `TICKET_ORDER_NOT_FOUND` | Invalid order |
| `TICKET_SLOT_NOT_FOUND` | Invalid slot |
| `WHATSAPP_SEND_FAILED` | Message not delivered |
| `CLAIM_NOT_FOUND` | Invalid/expired claim token |
| `INVITATION_FORBIDDEN` | Wrong user/phone |
