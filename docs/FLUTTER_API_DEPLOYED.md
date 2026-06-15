# YouPass — Flutter API Reference (Production)

**Base URL:** `https://youpass-backend.vercel.app/api/v1`

**Health:** `GET /health` · `GET /health/db`

---

## Authentication headers

| Header | When |
|--------|------|
| `Authorization: Bearer <access_token>` | Logged-in routes |
| `X-Device-Id: <uuid>` | All requests (one session per device) |
| `X-Platform` / `X-App-Version` | Optional analytics context |
| `recaptcha_token` in body | When `security.recaptcha_enabled: true` |

Load product rules on startup: **`GET /config/auth`**

---

## 1. Config & bootstrap

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/config` | — | Full app config + countries |
| GET | `/config/auth` | — | Auth, registration, post-registration, WhatsApp |
| GET | `/config/security` | — | reCAPTCHA, tokenization policy |
| GET | `/config/countries` | — | LATAM countries, currency, gateway |
| GET | `/config/categories` | — | Home browse chips |
| GET | `/config/event-categories` | — | Active event categories |
| GET | `/config/home-banners/carousel` | — | Main banner slides config |
| GET | `/config/currency/:country` | — | e.g. `CL` → CLP |
| GET | `/config/language/:country` | — | e.g. `CL` → es |
| GET | `/config/payment-gateway/:country` | — | `klap` or `stripe` |

**Detailed docs:** [FLUTTER_LATAM_API.md](./FLUTTER_LATAM_API.md) · [FLUTTER_PRODUCT_API.md](./FLUTTER_PRODUCT_API.md)

---

## 2. Auth (WhatsApp OTP)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/check-whatsapp` | — | Can number receive WhatsApp? |
| POST | `/auth/send-code` | — | Send OTP |
| POST | `/auth/resend-code` | — | Resend (60s cooldown) |
| POST | `/auth/verify-code` | — | Verify OTP only |
| POST | `/auth/login` | — | Existing user → JWT |
| POST | `/auth/register` | — | Create account → JWT |
| POST | `/auth/logout` | Bearer | Revoke session |
| POST | `/auth/change-phone/request` | Bearer | OTP to new number |
| POST | `/auth/change-phone/verify` | Bearer | Confirm phone change |
| POST | `/auth/delete-account/request` | Bearer | Deletion OTP |
| POST | `/auth/delete-account/verify` | Bearer | Confirm deletion |

**Detailed docs:** [FLUTTER_AUTH_REGISTRATION_API.md](./FLUTTER_AUTH_REGISTRATION_API.md) · [FLUTTER_POST_REGISTRATION_API.md](./FLUTTER_POST_REGISTRATION_API.md) · [FLUTTER_SECURITY_API.md](./FLUTTER_SECURITY_API.md)

---

## 3. YouHome (events screen)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/home/initial-feed` | Optional | Full layout: header, categories, banner, search meta, upcoming |
| GET | `/home/upcoming-events` | Optional | Paginated upcoming list only |

Query examples:

```
GET /home/initial-feed?country_code=CL&event_type=concerts&context=post_register
GET /home/upcoming-events?country_code=CL&page=1&limit=20
```

**Layout fields:** `data.layout.header` · `categories` · `main_banner` · `search` · `upcoming_events`

**Detailed doc:** [FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md)

---

## 4. Events & favorites

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events/types` | — | Filter chips (Parties, Concerts…) |
| GET | `/events/featured` | Optional | Featured carousel |
| GET | `/events` | Optional | List/search (`?q=football`) |
| GET | `/events/:id` | Optional | Event detail + `purchase` meta |
| GET | `/events/:id/availability` | Optional | Ticket availability summary |
| POST | `/events/:eventId/checkout` | Bearer | Purchase tickets / VIP table |
| POST | `/events/:eventId/checkout/confirm` | Bearer | Confirm after Klap/Stripe |
| GET | `/users/me/favorites/events` | Bearer | Favorited events |
| POST | `/users/me/favorites/events/:eventId` | Bearer | Add favorite |
| DELETE | `/users/me/favorites/events/:eventId` | Bearer | Remove favorite |
| GET | `/users/me/favorites/producers` | Bearer | Followed producers |
| POST | `/users/me/favorites/producers/:producerId` | Bearer | Follow producer |
| DELETE | `/users/me/favorites/producers/:producerId` | Bearer | Unfollow |

**Producers**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/producers/:id` | Optional | Producer profile |
| GET | `/producers/:id/upcoming-events` | Optional | Producer events |

---

## 5. VIP venue & ticket types

Nested under **`/events/:eventId/`**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/venues` | — | List physical venues |
| GET | `/venues/:id` | — | Venue detail |
| GET | `/events/:eventId/ticket-types` | — | Ticket offerings (Preventa, VIP…) |
| GET | `/events/:eventId/venue-layout` | Optional | Floor plan + zones |
| GET | `/events/:eventId/zones/:zoneId/tables` | Optional | Tables in zone |
| GET | `/events/:eventId/tables/:tableId` | Optional | Single table |
| GET | `/events/:eventId/tables/:tableId/lock/status` | Optional | Lock status |
| GET | `/events/:eventId/tables/availability/realtime` | Optional | Polling snapshot |
| POST | `/events/:eventId/tables/:tableId/lock` | Bearer | Hold table (~10 min) |
| DELETE | `/events/:eventId/tables/:tableId/lock` | Bearer | Release hold |

**Data model:** `venues` (reusable) → `event_venue_layouts` → `venue_zones` → `venue_tables` · `event_ticket_offerings`

Event objects include `venue_id` and `physical_venue` when linked.

**Detailed docs:**
- **[FLUTTER_TICKET_PURCHASE_INTEGRATION.md](./FLUTTER_TICKET_PURCHASE_INTEGRATION.md)** — Buy tickets migration (types, UX, lock)
- [FLUTTER_VIP_VENUE_API.md](./FLUTTER_VIP_VENUE_API.md) — endpoint reference

---

## 6. User profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Bearer | Profile |
| GET | `/users/me/welcome-data` | Bearer | 2s welcome screen copy |
| GET | `/users/me/profile-completeness` | Bearer | Complete-profile banner |
| GET | `/users/me/profile-banner/status` | Bearer | Banner visibility |
| POST | `/users/me/profile-banner/dismiss` | Bearer | Dismiss banner |
| PATCH | `/users/me/profile` | Bearer | Update profile |
| POST | `/users/me/profile-photo` | Bearer | Upload photo (multipart) |
| DELETE | `/users/me/photo` | Bearer | Remove photo |
| GET | `/users/me/category-benefits` | Bearer | Bronze/Silver/Gold perks |
| GET | `/users/me/notification-settings` | Bearer | Notification prefs |
| PATCH | `/users/me/notification-settings` | Bearer | Update prefs |

**Detailed doc:** [FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md)

---

## 7. Wallet & payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me/wallet/cards` | Bearer | Saved cards |
| POST | `/users/me/wallet/cards` | Bearer | Save tokenized card |
| POST | `/users/me/wallet/cards/tokenize-session` | Bearer | Klap/Stripe tokenize session |
| DELETE | `/users/me/wallet/cards/:id` | Bearer | Remove card |
| PATCH | `/users/me/wallet/cards/:id/default` | Bearer | Set default |
| GET | `/users/me/wallet/balance` | Bearer | Wallet balance |
| GET | `/users/me/wallet/transactions` | Bearer | Transaction history |
| GET | `/users/me/payment-methods` | Bearer | Legacy alias for cards |

**Rule:** Tokenized cards only — no raw PAN. Gateway from country: **Klap (CL)** · **Stripe (LATAM)**.

**Detailed docs:** [FLUTTER_SECURITY_API.md](./FLUTTER_SECURITY_API.md) · [FLUTTER_LATAM_API.md](./FLUTTER_LATAM_API.md) · [FLUTTER_MULTI_CURRENCY_BACKEND.md](./FLUTTER_MULTI_CURRENCY_BACKEND.md)

---

## 8. Invitations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/invitations/claim/:token` | — | Guest claim preview |
| GET | `/users/me/invitations` | Bearer | My invitations |
| GET | `/users/me/invitations/summary` | Bearer | Pending counts |
| GET | `/users/me/invitations/:id` | Bearer | Invitation detail |
| GET | `/users/me/invitations/:id/status` | Bearer | Status only |
| POST | `/users/me/invitations/:id/accept` | Bearer | Accept |
| POST | `/users/me/invitations/:id/reject` | Bearer | Reject |
| POST | `/users/me/invitations/:id/cancel` | Bearer | Cancel |

**Detailed doc:** [FLUTTER_INVITATIONS_API.md](./FLUTTER_INVITATIONS_API.md)

---

## 9. My tickets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me/tickets/upcoming` | Bearer | Upcoming tickets |
| GET | `/users/me/tickets/past` | Bearer | Past tickets |
| GET | `/users/me/tickets/yearly-summary` | Bearer | Year stats |
| GET | `/users/me/tickets/:id` | Bearer | Ticket detail |
| GET | `/users/me/tickets/:id/qr` | Bearer | QR payload |
| POST | `/users/me/tickets/:id/cancel` | Bearer | Cancel ticket |

**Detailed doc:** [FLUTTER_TICKETS_API.md](./FLUTTER_TICKETS_API.md)

---

## 10. Guest ticket assignment

Under **`/users/me/ticket-orders/:orderId/`**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `.../assignments` | Bearer | Assignment list |
| POST | `.../slots/:slotId/assign` | Bearer | Assign guest + WhatsApp invite |
| DELETE | `.../slots/:slotId/assign` | Bearer | Cancel assignment |
| POST | `.../slots/:slotId/resend` | Bearer | Resend WhatsApp invite |

**Detailed doc:** [FLUTTER_GUEST_TICKETS_API.md](./FLUTTER_GUEST_TICKETS_API.md)

---

## 11. Waitlist

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events/:id/waitlist/preview` | Bearer | Join preview |
| POST | `/events/:id/waitlist/join` | Bearer | Join waitlist |
| DELETE | `/events/:id/waitlist/leave` | Bearer | Leave |
| GET | `/events/:id/waitlist/position` | Bearer | Queue position |
| POST | `/waitlist/offers/:id/claim` | Bearer | Claim freed slot offer |

---

## 12. Support

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/support/contact-info` | — | Support email, hours |
| GET | `/support/faqs` | — | FAQ list |
| POST | `/support/faqs/:id/feedback` | — | FAQ helpful/not |
| GET | `/support/whatsapp-template` | Bearer | Support WhatsApp template |
| GET | `/support/email-template` | Bearer | Support email template |

---

## 13. Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/analytics/event/registration-completed` | Bearer | Post-register timing metrics |

---

## 14. Post-registration flow (critical)

```
POST /auth/register
  → Welcome screen 2s (welcome.* from response)
  → GET /home/initial-feed?context=post_register
  → YouHome (NOT Profile, NOT drawer)
  → POST /analytics/event/registration-completed
```

**Detailed doc:** [FLUTTER_POST_REGISTRATION_API.md](./FLUTTER_POST_REGISTRATION_API.md)

---

## Quick test commands

```bash
curl -s https://youpass-backend.vercel.app/api/v1/health
curl -s https://youpass-backend.vercel.app/api/v1/config/auth
curl -s "https://youpass-backend.vercel.app/api/v1/home/initial-feed?country_code=CL"
curl -s "https://youpass-backend.vercel.app/api/v1/events?country_code=CL&limit=5"
```

---

## All Flutter docs (index)

| Doc | Topic |
|-----|--------|
| [FLUTTER_API_DEPLOYED.md](./FLUTTER_API_DEPLOYED.md) | This file — production index |
| [FLUTTER_AUTH_REGISTRATION_API.md](./FLUTTER_AUTH_REGISTRATION_API.md) | Welcome Back, OTP, register |
| [FLUTTER_POST_REGISTRATION_API.md](./FLUTTER_POST_REGISTRATION_API.md) | Welcome → YouHome |
| [FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md) | YouHome layout, search, favorites |
| [FLUTTER_VIP_VENUE_API.md](./FLUTTER_VIP_VENUE_API.md) | Venue map, tables, checkout |
| [FLUTTER_INVITATIONS_API.md](./FLUTTER_INVITATIONS_API.md) | Invitations |
| [FLUTTER_TICKETS_API.md](./FLUTTER_TICKETS_API.md) | My tickets |
| [FLUTTER_GUEST_TICKETS_API.md](./FLUTTER_GUEST_TICKETS_API.md) | Assign tickets to guests |
| [FLUTTER_LATAM_API.md](./FLUTTER_LATAM_API.md) | Multi-country, checkout |
| [FLUTTER_PRODUCT_API.md](./FLUTTER_PRODUCT_API.md) | Product rules |
| [FLUTTER_SECURITY_API.md](./FLUTTER_SECURITY_API.md) | Device ID, reCAPTCHA, cards |
| [FLUTTER_MULTI_CURRENCY_BACKEND.md](./FLUTTER_MULTI_CURRENCY_BACKEND.md) | Currency fields |
| [FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md) | Auth + profile legacy guide |
| [FLUTTER_SESSION_TOKEN_FIX.md](./FLUTTER_SESSION_TOKEN_FIX.md) | SESSION_INVALID debug |

---

*Production deploy — base URL `youpass-backend.vercel.app`*
