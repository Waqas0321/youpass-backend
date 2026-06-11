# Flutter — Auth & Registration Screens API Guide

**Base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Stack note:** Backend is **Express + Prisma + MongoDB** (not NestJS/PostgreSQL). All endpoints below are live on this API.

This doc maps the **Welcome Back**, **OTP verification**, and **Create Account** screens to backend calls. UI layout, colors, and step order are Flutter-only; rules and copy come from the API.

**Related:** `FLUTTER_PRODUCT_API.md` (product rules), `FLUTTER_SECURITY_API.md` (device ID, reCAPTCHA), `FLUTTER_LATAM_API.md` (countries).

---

## 1. Bootstrap (app start)

```dart
final res = await dio.get('/config/auth');
final data = res.data['data'];
final auth = data['auth'];
final registration = data['registration'];
final ui = data['ui_messages']; // server-aligned error/help copy
```

### Key config fields

| Field | Use in Flutter |
|-------|----------------|
| `auth.otp_length` | OTP input boxes (6) |
| `auth.otp_ttl_minutes` / send-code `expires_in_seconds` | Code expiry countdown (180s) |
| `auth.otp_resend_cooldown_seconds` | Resend button timer (60s) |
| `auth.otp_max_resends_per_hour` | Max resends before `MAX_RESENDS` |
| `auth.otp_max_failed_attempts` | Show “X attempts left” |
| `auth.otp_block_minutes` | Lock duration (15 min) |
| `auth.session_indefinite` | No auto logout timer |
| `auth.support_email` | Help links (`soporte@youpass.app`) |
| `registration.gender_options` | Gender picker labels (es/pt/en) |
| `registration.terms_url` / `privacy_url` | Terms checkbox links |
| `registration.profile_photo_after_register` | Photo is **not** in register body |
| `ui_messages.*` | Fallback copy matching product spec |

### Gender values (API)

Send one of: `male`, `female`, `other`, `prefer_not_to_say`.  
Display labels from `registration.gender_options` (Man/Woman/Other/Prefer not to say).

---

## 2. Screen map — backend vs Flutter

| Screen / behavior | Backend | Flutter |
|-------------------|---------|---------|
| Logo, title “WELCOME BACK”, gold button | — | UI only |
| Country selector (flag + dial code) | `GET /config/countries` | UI + local phone input |
| Phone validation messages | `parseAndValidatePhone` on every auth call | Show API `message` |
| WhatsApp check before send | `POST /auth/check-whatsapp` | Optional pre-check; send-code also blocks |
| Send OTP | `POST /auth/send-code` | Navigate to OTP screen |
| 6-box OTP UI, auto-advance | — | UI only |
| Resend countdown 60s | `POST /auth/resend-code` | Timer from `resend_available_in_seconds` |
| “Didn’t get the code?” help | `ui_messages.whatsapp_help` | Static help text + mailto support |
| “Change number” confirm | — | UI dialog; `ui_messages.change_number_confirm` |
| Login existing user | `POST /auth/login` | After OTP if `account_exists: true` |
| New user → registration | send-code returns `purpose: "register"` | Wizard; final `POST /auth/register` |
| 6-step registration order | Single `POST /auth/register` | Steps 1–6 are UI-only |
| Profile photo | `POST /users/me/profile-photo` | After register (optional) |
| Social login | Not implemented | Hide / disable |
| Session persistence | JWT until logout | Secure storage |
| `X-Device-Id` header | One session per device | Stable UUID on all requests |

---

## 3. Welcome Back screen

### 3.1 Load countries

```http
GET /config/countries
```

Use each item’s `code`, `dial_code`, `flag_emoji`, `phone_hint`, `default_language` for the selector.

### 3.2 Validate phone (client-side optional)

Backend always validates. Recommended: disable “Continue” until minimum digits entered; final validation on API.

### 3.3 Check WhatsApp (recommended before send)

```http
POST /auth/check-whatsapp
Content-Type: application/json

{
  "phone": "912345678",
  "country_code": "CL"
}
```

| `whatsapp_available` | Flutter action |
|----------------------|----------------|
| `true` | Enable Continue / proceed to send-code |
| `false` | Show `message`; **do not** offer SMS |

### 3.4 Send verification code

```http
POST /auth/send-code
Content-Type: application/json
X-Device-Id: <stable-uuid>

{
  "phone": "912345678",
  "country_code": "CL",
  "purpose": "login"
}
```

**Success response (fields to persist for OTP screen):**

```json
{
  "phone": "+56912345678",
  "phone_display": "+56 9 1234 5678",
  "purpose": "login",
  "account_exists": true,
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

**New user (no account yet):**

```json
{
  "purpose": "register",
  "account_exists": false
}
```

Flutter: store `phone`, `country_code`, `purpose`, and navigate to OTP screen. Do **not** call login until you know `account_exists: true`.

### 3.5 Error mapping — Welcome Back

| Error code | HTTP | Message (EN) | Flutter |
|------------|------|--------------|---------|
| `PHONE_INVALID` | 400 | `Please enter a valid number` or `Check your number format` | Inline under input |
| `PHONE_UNSUPPORTED_COUNTRY` | 400 | `YouPass does not operate in this country yet` | Inline / dialog |
| `WHATSAPP_NOT_AVAILABLE` | 422 | Localized WhatsApp message + support email | Block flow |
| `BLOCKED` | 429 | `Too many attempts. Wait X minutes.` | Disable input; show timer from `retry_after_seconds` |
| `USER_EXISTS` | 409 | Only if `purpose: "register"` on send | Rare on login flow |

---

## 4. OTP verification screen

### 4.1 UI behavior (Flutter)

- 6 digit boxes; move focus on input
- Countdown: **3:00** from `expires_in_seconds` (180)
- Resend button disabled for **60s** (`resend_available_in_seconds`)
- Show masked phone: use `phone_display` from send-code
- Subtitle copy: *“Enter the 6-digit code we sent to your WhatsApp”* (UI string)
- Help footer: `ui_messages.whatsapp_help`

### 4.2 Resend code

```http
POST /auth/resend-code
```

Same body as send-code. On success, reset OTP expiry timer from new `expires_in_seconds`.

| Error code | Message | Flutter |
|------------|---------|---------|
| `RESEND_COOLDOWN` | `Resend code in N second(s)` | Use `retry_after_seconds` for button |
| `MAX_RESENDS` | `You have reached the maximum resends. Wait X minutes.` | Disable resend; show wait |
| `CODE_EXPIRED` | (on verify/login/register) `The code expired. Request a new one.` | Prompt resend |

### 4.3 After OTP entry — branch by `purpose`

**Existing user (`purpose: "login"`, `account_exists: true`):**

```http
POST /auth/login
X-Device-Id: <stable-uuid>

{
  "phone": "912345678",
  "country_code": "CL",
  "code": "123456"
}
```

Response:

```json
{
  "access_token": "eyJ...",
  "session_id": "...",
  "expires_at": null,
  "session_indefinite": true,
  "is_new_user": false,
  "user": { "id": "...", "full_name": "...", "phone": "+569..." }
}
```

Store `access_token`; set `Authorization: Bearer <token>` on subsequent requests.

**New user (`purpose: "register"`):**

Do **not** call `/auth/login`. Store the verified `code` in registration state and navigate to **Create Account** wizard. The same code is sent again in `POST /auth/register` (single-use at register time).

Optional: `POST /auth/verify-code` with `purpose: "register"` if you need server-side verify before the wizard — but then register must happen before code expires (3 min). Prefer going straight to the wizard after OTP UI validation and submitting register promptly.

### 4.4 Wrong code / lockout

```json
{
  "error": {
    "code": "INVALID_CODE",
    "message": "Incorrect code",
    "details": { "remaining_attempts": 2 }
  }
}
```

Show: *“Incorrect code. X attempts remaining.”*

After 3 failures:

```json
{
  "error": {
    "code": "BLOCKED",
    "message": "Too many failed attempts. Wait 15 minutes.",
    "details": { "retry_after_seconds": 900 }
  }
}
```

Lock scope is **per phone number** (not per device). Disable OTP input until `retry_after_seconds` elapses.

### 4.5 Change number

Flutter-only: confirm with `ui_messages.change_number_confirm`, then pop to Welcome Back. Backend invalidates previous OTP when a new send-code runs.

---

## 5. Create Account screen (6-step wizard)

Backend accepts **one** register request. The 6 steps are a Flutter UX split; collect all fields then submit.

### Recommended step → field mapping

| Step | Field | API key | Required |
|------|-------|---------|----------|
| 1 | Full name | `full_name` | Yes |
| 2 | RUT / passport | `rut_or_passport` | Yes |
| 3 | Date of birth | `birthdate` (`YYYY-MM-DD`) | Yes, 18+ |
| 4 | Gender | `gender` | Yes |
| 5 | Phone + country | Already from Welcome Back | Yes |
| 6 | Email + terms | `email`, `accept_terms: true` | Yes |
| — | Instagram | `instagram_username` | Optional (strip `@`) |
| — | Language | `preferred_language` | Optional; default = country `default_language` |
| — | OTP code | `code` | Yes (from OTP screen) |
| After | Profile photo | `POST /users/me/profile-photo` | Optional |

### Submit registration

```http
POST /auth/register
X-Device-Id: <stable-uuid>

{
  "phone": "912345678",
  "country_code": "CL",
  "code": "123456",
  "full_name": "Jane Doe",
  "rut_or_passport": "12345678-9",
  "email": "jane@example.com",
  "birthdate": "1990-05-15",
  "gender": "female",
  "instagram_username": "jane",
  "preferred_language": "es",
  "accept_terms": true
}
```

Success: same shape as login (`access_token`, `session_indefinite: true`, `is_new_user: true`).

### Registration errors

| Code | Message | Flutter |
|------|---------|---------|
| `UNDERAGE` | `Sorry, YouPass is a platform exclusively for those over 18...` | Block submit; highlight DOB |
| `USER_EXISTS` | Account already exists | Redirect to Welcome Back / login |
| `INVALID_CODE` / `CODE_EXPIRED` | OTP invalid/expired | Send back to OTP or resend |
| `INVALID_BIRTHDATE` | Invalid birthdate | Fix date picker format |

### Profile photo (post-register)

```http
POST /users/me/profile-photo
Authorization: Bearer <token>
Content-Type: multipart/form-data

photo: <file>
```

Skip in wizard if user taps “Skip”; offer later in profile settings.

---

## 6. Session & logout

- **Indefinite session:** `expires_at: null`, `session_indefinite: true`
- Do not force re-auth on a timer
- Clear token on `POST /auth/logout` or HTTP `401` with `SESSION_INVALID`
- Always send **`X-Device-Id`** (same UUID for the device lifetime)

---

## 7. Phone change (settings)

Not part of Welcome Back, but same OTP pattern:

```http
POST /auth/change-phone/request   (Bearer)
{ "new_phone": "...", "new_country_code": "MX" }

POST /auth/change-phone/verify    (Bearer)
{ "new_phone": "...", "new_country_code": "MX", "code": "123456" }
```

OTP goes to the **new** number only. UI copy: *“Enter the code we sent to your NEW WhatsApp number.”*

---

## 8. reCAPTCHA (when enabled)

If `security.recaptcha_enabled: true`, include on send-code, resend-code, login, register:

```json
{ "recaptcha_token": "<token from Flutter plugin>" }
```

Site key: `security.recaptcha_site_key`.

---

## 9. Sandbox testing (Twilio)

1. Join sandbox: send `join <sandbox-code>` to **+1 415 523 8886** from each test phone in WhatsApp
2. Same API endpoints — no Flutter code changes for sandbox vs production
3. OTP sender may show as Twilio in sandbox (expected)

---

## 12. Checklist

```
[ ] GET /config/auth on cold start — cache auth, registration, ui_messages, post_registration
[ ] GET /config/countries — country picker
[ ] Welcome Back: check-whatsapp → send-code (purpose: login)
[ ] Handle account_exists: false → registration flow after OTP
[ ] OTP: 6 digits, 180s expiry, 60s resend cooldown
[ ] Show remaining_attempts on INVALID_CODE
[ ] 15 min lock UI on BLOCKED (retry_after_seconds)
[ ] Login OR register with same phone/country/code from state
[ ] Registration wizard: collect fields → single POST /auth/register
[ ] After register: Welcome 2s → YouHome directly (see FLUTTER_POST_REGISTRATION_API.md)
[ ] accept_terms: true + link terms_url / privacy_url
[ ] gender from registration.gender_options
[ ] Photo: POST /users/me/profile-photo after register (optional, from Profile only)
[ ] No SMS fallback anywhere
[ ] No social login (social_login_enabled: false)
[ ] X-Device-Id on all requests
[ ] Secure storage for access_token; logout clears it
```

---

## Related docs

| Doc | Topic |
|-----|--------|
| `FLUTTER_POST_REGISTRATION_API.md` | Welcome → YouHome flow (inviolable) |
| `FLUTTER_LATAM_API.md` | Countries, currency, checkout |

| Code | Screen | Typical message |
|------|--------|-----------------|
| `PHONE_INVALID` | Welcome Back | Please enter a valid number / Check your number format |
| `PHONE_UNSUPPORTED_COUNTRY` | Welcome Back | YouPass does not operate in this country yet |
| `WHATSAPP_NOT_AVAILABLE` | Welcome Back | Cannot receive WhatsApp (+ support email) |
| `RESEND_COOLDOWN` | OTP | Resend code in N seconds |
| `MAX_RESENDS` | OTP | You have reached the maximum resends. Wait X minutes. |
| `INVALID_CODE` | OTP | Incorrect code (+ remaining_attempts) |
| `CODE_EXPIRED` | OTP / Register | The code expired. Request a new one. |
| `BLOCKED` | Any | Too many attempts / failed attempts. Wait X minutes. |
| `USER_NOT_FOUND` | Login | No account found |
| `USER_EXISTS` | Register | Account already exists |
| `UNDERAGE` | Register | Over 18 required |
| `SESSION_INVALID` | App | Force re-login |
| `OTP_DELIVERY_FAILED` | Send | WhatsApp delivery failed — retry later |

---

## 11. Full error code reference
