# Flutter — Security & Auth API Integration

**Base URL:** `https://youpass-backend.vercel.app/api/v1`

This doc covers **attack protection**, **encryption**, and **Flutter changes** required to work with the secured backend.

---

## Backend security — already implemented

| Requirement | Status | How |
|-------------|--------|-----|
| OTP brute force (3 fails → 15 min lock) | ✅ | `OTP_MAX_FAILED_ATTEMPTS=3`, `OTP_BLOCK_MINUTES=15` |
| Code spam (max 5 resends/hour) | ✅ | `OTP_MAX_RESENDS_PER_HOUR=5` + 60s cooldown |
| OTP stored as hash | ✅ | bcrypt hash in `auth_codes.code_hash` |
| JWT signed + configurable expiry | ✅ | `JWT_SECRET`, `JWT_EXPIRES_IN` (default `365d`) |
| Session validation on every request | ✅ | Bearer token + DB session + token hash |
| One session per device | ✅ | Send `X-Device-Id` header |
| SIM swap protection | ✅ | Phone change OTP sent to **new** number only |
| HTTPS only | ✅ | Vercel TLS 1.2+ + HSTS in production |
| Payment cards tokenized | ✅ | Raw PAN rejected unless `ALLOW_LEGACY_CARD_INPUT=true` |
| reCAPTCHA on critical screens | ✅ | When `RECAPTCHA_ENABLED=true` on server |
| Data encrypted at rest | ✅ | MongoDB Atlas encryption at rest |

---

## 1. Load security policy (app bootstrap)

**`GET /config/security`** or **`GET /config`** (includes `security` object)

```json
{
  "success": true,
  "data": {
    "otp_max_failed_attempts": 3,
    "otp_block_minutes": 15,
    "otp_max_resends_per_hour": 5,
    "otp_resend_cooldown_seconds": 60,
    "otp_ttl_minutes": 3,
    "jwt_expires_in": "365d",
    "one_session_per_device": true,
    "recaptcha_enabled": true,
    "recaptcha_site_key": "6Le...",
    "payment_tokenization_required": true,
    "transport": "https_only",
    "otp_storage": "hashed"
  }
}
```

Use this to drive UI (show reCAPTCHA widget, show remaining attempts, etc.).

---

## 2. Device ID — required header

Send a **stable per-installation ID** on every request:

```dart
final deviceId = await DeviceIdService.instance.getId(); // UUID persisted locally

final headers = {
  'Content-Type': 'application/json',
  'X-Device-Id': deviceId,
  'X-Platform': Platform.isIOS ? 'ios' : 'android',
  'X-App-Version': packageInfo.version,
  if (accessToken != null) 'Authorization': 'Bearer $accessToken',
};
```

**Behavior:** Logging in on the same device revokes the previous session on that device. Other devices stay logged in.

---

## 3. reCAPTCHA — when enabled

When `security.recaptcha_enabled == true`, send **`recaptcha_token`** on:

| Screen | Endpoint | Suggested action name |
|--------|----------|----------------------|
| Send OTP | `POST /auth/send-code` | `send_code` |
| Resend OTP | `POST /auth/resend-code` | `resend_code` |
| Login | `POST /auth/login` | `login` |
| Register | `POST /auth/register` | `register` |
| Checkout | `POST /events/:id/checkout` | `checkout` |

### Request body example

```json
{
  "phone": "912345678",
  "country_code": "CL",
  "purpose": "login",
  "recaptcha_token": "03AGdBq..."
}
```

### Flutter setup (reCAPTCHA v3 recommended)

```dart
// pubspec: google_recaptcha_v3 or flutter_recaptcha_v2

Future<String?> getRecaptchaToken(String action) async {
  if (!appConfig.security.recaptchaEnabled) return null;
  return recaptcha.execute(action); // action matches table above
}

await dio.post('/auth/send-code', data: {
  'phone': phone,
  'country_code': countryCode,
  'purpose': 'login',
  if (token != null) 'recaptcha_token': token,
});
```

### Error codes

| Code | HTTP | Flutter action |
|------|------|----------------|
| `RECAPTCHA_REQUIRED` | 400 | Show reCAPTCHA, retry |
| `RECAPTCHA_FAILED` | 400/403 | Refresh token, retry |

When reCAPTCHA is **disabled** on server (dev), omit `recaptcha_token` — requests still work.

---

## 4. OTP brute force — handle errors in UI

### Wrong code

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CODE",
    "message": "Incorrect code",
    "details": { "remaining_attempts": 2 }
  }
}
```

Show: *"Incorrect code. 2 attempts remaining."*

### Blocked (3 failed attempts)

```json
{
  "success": false,
  "error": {
    "code": "BLOCKED",
    "message": "Too many failed attempts. Please wait 15 minute(s).",
    "details": { "retry_after_seconds": 900 }
  }
}
```

Disable verify button and show countdown from `retry_after_seconds`.

### Resend limits

| Code | Meaning |
|------|---------|
| `RESEND_COOLDOWN` | Wait `retry_after_seconds` (60s default) |
| `MAX_RESENDS` | 5 resends/hour exceeded — show wait time |

---

## 5. JWT & session

### Login / register response

```json
{
  "access_token": "eyJ...",
  "session_id": "...",
  "expires_at": "2027-06-10T12:00:00.000Z"
}
```

- Store `access_token` securely (`flutter_secure_storage`)
- Send as `Authorization: Bearer <token>` on protected routes
- On `401` + `SESSION_INVALID` → clear token and go to login

### Logout

`POST /auth/logout` with Bearer token — revokes current session only.

---

## 6. Phone change (SIM swap protection)

**No change to endpoints** — backend already sends OTP to the **new** number.

| Step | Endpoint |
|------|----------|
| 1 | `POST /auth/change-phone/request` `{ "new_phone", "new_country_code" }` |
| 2 | User receives OTP on **new** WhatsApp/SMS |
| 3 | `POST /auth/change-phone/verify` `{ "new_phone", "new_country_code", "code" }` |

Flutter: make clear in UI that the code goes to the **new** number, not the old one.

---

## 7. Payment methods — tokenized only

**Do not send raw card numbers** in production.

### Old (deprecated — rejected when `payment_tokenization_required: true`)

```json
{
  "card_number": "4111...",
  "expiry": "12/28",
  "cvv": "123",
  "cardholder_name": "Jane Doe"
}
```

### New (required)

Tokenize on client via **Klap SDK** (Chile) or **Stripe SDK** (LATAM), then:

```json
{
  "payment_method_id": "pm_xxx_or_klap_token",
  "gateway": "stripe",
  "brand": "visa",
  "last_four": "4242",
  "cardholder_name": "Jane Doe"
}
```

For Chile: `"gateway": "klap"`.

### Error

| Code | Message |
|------|---------|
| `CARD_TOKENIZATION_REQUIRED` | Use gateway token, not raw card |

---

## 8. Checkout security

Add `recaptcha_token` when enabled:

```dart
await dio.post('/events/$eventId/checkout', data: {
  'offering_id': 'general',
  'quantity': 2,
  if (recaptchaToken != null) 'recaptcha_token': recaptchaToken,
});
```

---

## 9. Flutter migration checklist

```
[ ] GET /config/security on app start
[ ] Persist + send X-Device-Id on all requests
[ ] Integrate reCAPTCHA when recaptcha_enabled
[ ] Add recaptcha_token to send-code, resend, login, register, checkout
[ ] OTP UI: show remaining_attempts from error details
[ ] OTP UI: countdown on BLOCKED / RESEND_COOLDOWN / MAX_RESENDS
[ ] Secure storage for access_token
[ ] Handle SESSION_INVALID → force re-login
[ ] Payment: Stripe/Klap tokenization — remove raw card form
[ ] Phone change copy: "Code sent to your NEW number"
[ ] Never log OTP codes or tokens in release builds
```

---

## 10. Vercel env (backend team)

| Variable | Production value |
|----------|-------------------|
| `JWT_SECRET` | Long random string (min 16 chars) |
| `JWT_EXPIRES_IN` | e.g. `365d` or `30d` |
| `RECAPTCHA_ENABLED` | `true` |
| `RECAPTCHA_SECRET_KEY` | From Google reCAPTCHA admin |
| `RECAPTCHA_SITE_KEY` | Public key for Flutter |
| `ALLOW_LEGACY_CARD_INPUT` | `false` |

---

## Related docs

- `FLUTTER_LATAM_API.md` — multi-country config
- `TWILIO_OTP_IMPLEMENTATION.md` — WhatsApp OTP setup

---

*Last updated: June 2026*
