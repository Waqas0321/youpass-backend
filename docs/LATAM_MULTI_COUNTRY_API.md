# YouPass — Multi-Country LATAM Backend API

Base URL: `https://youpass-backend.vercel.app/api/v1`

Gateway routing is **server-side only**:

| Country | Gateway | Currency |
|---------|---------|----------|
| CL (Chile) | `klap` | CLP |
| All other LATAM (+ PK) | `stripe` | per country |

---

## Config endpoints

### `GET /config`

Aggregate app config (countries + defaults).

### `GET /config/countries`

Rich country list for Flutter country picker. Each row includes:

- `code`, `name`, `dialCode` / `dial_code`, `flagEmoji` / `flag_emoji`
- `phoneHint` / `phone_hint`
- `defaultLanguage` / `default_language` (`es`, `pt`, `en`)
- `defaultCurrency` / `default_currency`
- `timezone`, `paymentGateway` / `payment_gateway`
- `isActive`, `sortOrder`

Both camelCase and snake_case keys are returned for backward compatibility.

### `GET /config/categories`

Browse chips for home screen:

```json
{
  "categories": [
    { "id": "all", "label": "All" },
    { "id": "country:CL", "label": "Chile", "countryCode": "CL" },
    { "id": "parties", "label": "Parties", "eventTypeSlug": "parties" }
  ]
}
```

### Existing helpers

- `GET /config/currency/:country`
- `GET /config/language/:country`
- `GET /config/payment-gateway/:country`

---

## Events & home feed

- `GET /home/initial-feed?country_code=MX` — filters featured events; defaults to logged-in user's `countryCode` when omitted.
- `GET /events?country_code=CL` — browse by country.
- `GET /events/:id` — includes `timezone`, localized date display, and `purchase.currency` / `purchase.payment_gateway` from event country.

---

## Checkout

### Mock (default: `CHECKOUT_MOCK_PAYMENT=true`)

`POST /events/:eventId/checkout` completes immediately with `status: paid`. Currency and gateway come from the event's country.

### Real payments (`CHECKOUT_MOCK_PAYMENT=false`)

**Phase A — omit `payment_method_id`:**

Returns `status: payment_pending` with gateway payload:

```json
{
  "status": "payment_pending",
  "gateway": "klap",
  "currency": "CLP",
  "total_amount": 73500,
  "payment_url": "https://...",
  "klap": { "payment_url": "...", "session_id": "..." }
}
```

Stripe LATAM returns `stripe.payment_intent_id`, `client_secret`, `customer_id`.

**Phase B — webhooks:**

- `POST /webhooks/klap` — body `{ "order_id", "status": "paid" }`
- `POST /webhooks/stripe` — Stripe `payment_intent.succeeded` with `metadata.order_id`

**Phase C — app confirm (optional):**

`POST /events/:eventId/checkout/confirm`

```json
{ "order_id": "ord_abc123" }
```

---

## User profile

`GET /users/me` now includes:

```json
{
  "country_code": "CL",
  "preferred_language": "es"
}
```

Set on register (`preferred_language` optional) or `PATCH /users/me/profile`.

---

## Phone validation

Auth and guest assignment validate E.164 via `libphonenumber-js` against active countries.

Error codes:

- `PHONE_INVALID`
- `PHONE_UNSUPPORTED_COUNTRY`

---

## OTP language

OTP WhatsApp/SMS messages use the country's `languageCode` (`es`, `pt`, `en`).

---

## Environment secrets

| Variable | Purpose |
|----------|---------|
| `KLAP_API_KEY` | Chile payments |
| `KLAP_WEBHOOK_SECRET` | Klap webhook verification |
| `STRIPE_SECRET_KEY` | LATAM payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |

---

*June 2026 — aligned with Flutter multi-country handoff.*
