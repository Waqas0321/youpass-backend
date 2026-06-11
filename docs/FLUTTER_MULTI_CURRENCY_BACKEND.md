# Backend — Multi-Currency Confirmation (Flutter Audit Response)

**Date:** June 2026  
**Base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Answers:** Flutter multi-currency audit questions 1–7

---

## Verdict: ✅ Backend ready (Flutter should wire `purchase.currency`)

Currency is derived from **event `country_code`** → `countries` table. No silent CLP for non-Chile events in API responses.

---

## Answers to copy-paste questions

### 1. Mexico event — `GET /events/:id`

**Yes.** For an event with `country_code: "MX"`:

```json
{
  "country_code": "MX",
  "purchase": {
    "currency": "MXN",
    "currency_symbol": "$",
    "currency_decimals": 2,
    "country_code": "MX",
    "payment_gateway": "stripe",
    "service_fee_rate": 0.05,
    "has_ticket_offerings": true,
    "has_venue_layout": false
  }
}
```

### 2. Ticket-types and zone tables for non-Chile events

**Yes.**

- `GET /events/:id/ticket-types` — bundle + each offering include `currency`, `country_code`, `currency_decimals`
- `GET /events/:id/zones/:zoneId/tables` — zone bundle includes `currency`, `country_code`, `currency_decimals`; each table has `currency`

Currency always matches event country (overrides stale DB `CLP` defaults).

### 3. Checkout response

**Yes.** Always returns event currency and amounts in that currency:

```json
{
  "currency": "MXN",
  "currency_decimals": 2,
  "currency_symbol": "$",
  "country_code": "MX",
  "payment_gateway": "stripe",
  "subtotal_amount": 35000,
  "service_fee_amount": 1750,
  "total_amount": 36750
}
```

### 4. `GET /config/countries`

**Yes.** All 19 active LATAM + PK countries include:

- `default_currency` / `defaultCurrency`
- `currency_symbol` / `currencySymbol`
- `currency_decimals` / `currencyDecimals`
- `payment_gateway` / `paymentGateway`

Examples: CL → CLP (0 decimals), MX → MXN (2), BR → BRL (2), CO → COP (0).

### 5. Event list endpoints

**Yes for `country_code`.**  
`GET /events`, `GET /events/featured`, `GET /home/initial-feed` — every event object includes `country_code`.

**No for list prices** — `from_price` / `min_price` not returned (product decision: no price on browse cards yet).

### 6. Amount units

**Integer major units** (display units, not centavos):

| Currency | Decimals | Example stored value | Display |
|----------|----------|----------------------|---------|
| CLP, COP, PYG | 0 | `35000` | $35.000 |
| MXN, ARS, BRL | 2 | `35000` | $350.00 |

Use `currency_decimals` from API for formatting — do **not** divide by 100 unless product changes convention.

---

## Endpoint reference

| Endpoint | Currency fields |
|----------|-----------------|
| `GET /config/countries` | Per country: currency, symbol, decimals, gateway |
| `GET /events/:id` | `country_code`, `purchase.currency`, `purchase.currency_decimals`, `purchase.payment_gateway` |
| `GET /events/:id/ticket-types` | Bundle + each offering: `currency`, `country_code`, `currency_decimals` |
| `GET /events/:id/zones/:zoneId/tables` | Zone + each table: `currency`, `country_code`, `currency_decimals` |
| `POST /events/:id/checkout` | `currency`, `currency_decimals`, `subtotal_amount`, `service_fee_amount`, `total_amount`, `payment_gateway` |
| `GET /events`, `/featured`, `/home/initial-feed` | `country_code` on each event (no price) |

---

## Flutter recommended fixes (from audit)

Backend now guarantees data — Flutter should:

1. **Wire `purchase.currency`** into `VipPurchaseSession` when opening ticket selection.
2. Use **`purchase.currency`** before country-default fallback.
3. Prefer API `currency_decimals` over hardcoded CLP assumptions.
4. Keep CLP fallbacks only as last-resort dev safety (log in debug when used).

---

## Test calls

```bash
# Countries — MX currency metadata
curl -s "$BASE/config/countries" | jq '.data[] | select(.code=="MX") | {code, default_currency, currency_decimals, payment_gateway}'

# Event list — country_code on every row
curl -s "$BASE/events?country_code=MX&limit=3" | jq '.data.events[] | {id, title, country_code}'

# Event detail — purchase meta
curl -s "$BASE/events/EVENT_ID" | jq '.data | {country_code, purchase}'

# Ticket types
curl -s "$BASE/events/EVENT_ID/ticket-types" | jq '{country_code, currency, currency_decimals, first: .data.offerings[0]}'

# Checkout (mock)
curl -s -X POST "$BASE/events/EVENT_ID/checkout" -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" -d '{"offering_id":"general","quantity":1}' \
  | jq '.data | {currency, currency_decimals, payment_gateway, total_amount}'
```

---

## Related docs

- `FLUTTER_LATAM_API.md` — full LATAM integration
- `FLUTTER_PRODUCT_API.md` — auth & product rules

---

*Backend updated June 2026 — currency resolved from event country on all pricing endpoints.*
