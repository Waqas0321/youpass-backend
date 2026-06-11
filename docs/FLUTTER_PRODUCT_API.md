# Flutter — Product Decisions API Guide

**Base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Auth channel:** WhatsApp Business **only** (no SMS)  
**Sandbox testing:** Twilio sandbox `+14155238886` (join code required on test phones)

Load full product rules on app start: **`GET /config/auth`** or **`GET /config`**

---

## Confirmed product rules (backend enforces)

| Decision | API behavior |
|----------|--------------|
| Auth via WhatsApp only | `channel: "whatsapp"`, `sms_enabled: false` |
| 6-digit OTP, 3 min TTL | `otp_length: 6`, `expires_in_seconds: 180` |
| Resend cooldown 60s | `resend_available_in_seconds: 60` |
| Max 5 resends/hour | Error `MAX_RESENDS` |
| 15 min lock after 3 wrong codes | Error `BLOCKED`, `remaining_attempts` in details |
| No WhatsApp → clear message | `POST /auth/check-whatsapp` + error `WHATSAPP_NOT_AVAILABLE` |
| Full registration | Required fields below; photo **after** register |
| Session until logout | `session_indefinite: true`, `expires_at: null` |
| Phone change | OTP to **new** number + automatic data migration |
| Chile + LATAM | `GET /config/countries` |
| Multi-currency / language | Per country in config |
| Payments | Klap (CL) + Stripe (LATAM) — server decides |

---

## 1. Bootstrap — load config

```dart
final res = await dio.get('/config/auth');
final auth = res.data['data']['auth'];
final registration = res.data['data']['registration'];
final commerce = res.data['data']['commerce'];
```

### `GET /config/auth` response

```json
{
  "auth": {
    "channel": "whatsapp",
    "whatsapp_only": true,
    "sms_enabled": false,
    "otp_length": 6,
    "otp_ttl_minutes": 3,
    "otp_resend_cooldown_seconds": 60,
    "otp_max_resends_per_hour": 5,
    "otp_max_failed_attempts": 3,
    "otp_block_minutes": 15,
    "session_indefinite": true,
    "session_expires_on_logout_only": true
  },
  "registration": {
    "required_fields": ["phone", "country_code", "code", "full_name", "email", "birthdate", "gender", "rut_or_passport", "accept_terms"],
    "optional_fields": ["instagram_username", "preferred_language", "profile_photo"],
    "profile_photo_after_register": true,
    "min_age_years": 18
  },
  "commerce": {
    "countries": "chile_and_latam",
    "multi_currency": true,
    "multi_language": true,
    "language_source": "country_default",
    "gateways": { "CL": "klap", "default": "stripe" }
  }
}
```

Use `auth.*` values to drive OTP UI (countdowns, attempt counters) — do not hardcode.

---

## 2. WhatsApp-only auth flow

### Step A — Check WhatsApp (before send-code)

```http
POST /auth/check-whatsapp
```

```json
{
  "phone": "912345678",
  "country_code": "CL"
}
```

**Response (OK):**

```json
{
  "whatsapp_available": true,
  "can_receive_otp": true,
  "delivery_channel": "whatsapp",
  "auth_channel": "whatsapp_only",
  "sms_enabled": false,
  "message": "Te enviaremos tu código de verificación por WhatsApp Business.",
  "message_key": "WHATSAPP_READY"
}
```

**Response (no WhatsApp):**

```json
{
  "whatsapp_available": false,
  "can_receive_otp": false,
  "message": "Este número no puede recibir WhatsApp. YouPass usa solo WhatsApp Business...",
  "message_key": "WHATSAPP_REQUIRED"
}
```

Show the `message` string in UI — do not offer SMS fallback.

### Step B — Send OTP

```http
POST /auth/send-code
```

```json
{
  "phone": "912345678",
  "country_code": "CL",
  "purpose": "login"
}
```

**Response includes policy meta:**

```json
{
  "channel": "whatsapp",
  "otp_length": 6,
  "expires_in_seconds": 180,
  "resend_available_in_seconds": 60,
  "max_resends_per_hour": 5,
  "max_failed_attempts": 3,
  "block_minutes": 15,
  "whatsapp_available": true
}
```

### Step C — Resend (60s countdown)

```http
POST /auth/resend-code
```

Same body as send-code. Show 60s timer from `resend_available_in_seconds`. After 5 resends/hour → `MAX_RESENDS`.

### Step D — Verify wrong code

Error `INVALID_CODE` with:

```json
{ "details": { "remaining_attempts": 2 } }
```

After 3 failures → `BLOCKED` with `retry_after_seconds: 900` (15 min).

### Step E — Login / Register

```http
POST /auth/login
POST /auth/register
```

Register body:

```json
{
  "phone": "912345678",
  "country_code": "CL",
  "code": "123456",
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "birthdate": "1990-05-15",
  "gender": "female",
  "rut_or_passport": "12345678-9",
  "instagram_username": "jane",
  "preferred_language": "es",
  "accept_terms": true
}
```

**Photo:** upload **after** register via `POST /users/me/profile-photo` (optional).

**Language:** auto from country if `preferred_language` omitted — use `defaultLanguage` from `/config/countries`.

---

## 3. Session — until manual logout

Login/register response:

```json
{
  "access_token": "eyJ...",
  "session_id": "...",
  "expires_at": null,
  "session_indefinite": true
}
```

- Store token in secure storage
- Do **not** force re-login on a timer
- Only clear on `POST /auth/logout` or `401 SESSION_INVALID`
- Send header **`X-Device-Id`** (stable UUID) — one session per device

---

## 4. Phone change + migration

```http
POST /auth/change-phone/request   (Bearer)
{ "new_phone": "...", "new_country_code": "CL" }

POST /auth/change-phone/verify  (Bearer)
{ "new_phone": "...", "new_country_code": "CL", "code": "123456" }
```

- OTP is sent to the **new** number only
- Backend migrates invitations + guest assignments automatically

Verify response:

```json
{
  "message": "Phone number updated successfully",
  "migration": {
    "invitations_updated": 2,
    "slots_updated": 1,
    "linked_invitations": 0
  }
}
```

UI copy: *"Enter the code we sent to your NEW WhatsApp number."*

---

## 5. LATAM + payments (summary)

See **`FLUTTER_LATAM_API.md`** for:

- `GET /config/countries` — currency, language, gateway per country
- `GET /config/categories` — home browse chips
- Checkout — `purchase.payment_gateway` (`klap` vs `stripe`)

**Rule:** Never pick Klap/Stripe in Flutter — use API `gateway` field.

---

## 6. Sandbox testing (Twilio)

For QA / release APK testing:

1. Each test phone sends `join <code>` to **`+1 415 523 8886`** in WhatsApp
2. Backend uses sandbox sender `+14155238886`
3. OTP arrives from **Twilio** (not YouPass branding) — expected in sandbox
4. Same APIs — no Flutter changes for sandbox vs production

---

## 7. Flutter checklist

```
[ ] GET /config/auth on startup — cache auth + registration + commerce rules
[ ] Remove any SMS UI or fallback
[ ] check-whatsapp before send-code; show message if WHATSAPP_REQUIRED
[ ] OTP input: 6 digits; timer from expires_in_seconds (180s)
[ ] Resend button: 60s countdown from resend_available_in_seconds
[ ] Show remaining_attempts on wrong code
[ ] Block UI 15 min on BLOCKED (retry_after_seconds)
[ ] Registration: all required fields; photo optional after register
[ ] Language from country defaultLanguage (es/pt/en)
[ ] Session: no auto-expire; logout only
[ ] X-Device-Id header on all requests
[ ] Phone change: OTP to NEW number + show migration success
[ ] Currency/gateway from API (LATAM doc)
[ ] Sandbox: join Twilio sandbox on test phones
```

---

## 8. Error codes reference

| Code | When |
|------|------|
| `WHATSAPP_NOT_AVAILABLE` | Number cannot receive WhatsApp |
| `WHATSAPP_REQUIRED` | message_key when check fails |
| `INVALID_CODE` | Wrong OTP (+ remaining_attempts) |
| `BLOCKED` | 3 failed attempts |
| `RESEND_COOLDOWN` | Resend before 60s |
| `MAX_RESENDS` | 5 resends/hour exceeded |
| `CODE_EXPIRED` | OTP older than 3 min |
| `SESSION_INVALID` | Force re-login |

---

## Related docs

| Doc | Topic |
|-----|--------|
| `FLUTTER_AUTH_REGISTRATION_API.md` | Welcome Back, OTP, Create Account screens |
| `FLUTTER_POST_REGISTRATION_API.md` | Welcome → YouHome after register |
| `FLUTTER_LATAM_API.md` | Countries, currency, checkout |
| `FLUTTER_SECURITY_API.md` | reCAPTCHA, device ID, tokenization |
| `FLUTTER_VIP_VENUE_API.md` | VIP tables & checkout |

---

*Last updated: June 2026 — production `youpass-backend.vercel.app`*
