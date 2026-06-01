# Twilio OTP — Implementation Guide

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

YOUPASS sends OTP codes via **Twilio** (SMS or WhatsApp). Meta WhatsApp Business API is **not** used.

---

## Overview

- 6-digit OTP, bcrypt-hashed in MongoDB
- 3-minute TTL, single-use codes
- Delivery channel: **`whatsapp`** by default (configurable to `sms` via `OTP_DELIVERY_CHANNEL`)
- **6-digit** OTP (`OTP_LENGTH=6`, enforced in API validation)
- Mock mode logs OTP to console when `TWILIO_MOCK=true`

---

## Architecture

```
Client → POST /auth/send-code
           → Validate phone → Generate OTP → Save hash → Twilio send (SMS or WhatsApp)
       → POST /auth/verify-code /login /register
```

| File | Role |
|------|------|
| `src/modules/auth/otp-delivery.service.ts` | Twilio + mock sender |
| `src/modules/auth/auth.service.ts` | OTP business logic |
| `src/config/env.ts` | Twilio env vars |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OTP_DELIVERY_CHANNEL` | No | `whatsapp` (default) or `sms` |
| `OTP_LENGTH` | No | `6` (6-digit codes) |
| `TWILIO_ACCOUNT_SID` | Live mode | From [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Live mode | Twilio auth token |
| `TWILIO_SMS_FROM` | SMS channel | Your Twilio phone number (E.164, e.g. `+12025551234`) |
| `TWILIO_WHATSAPP_FROM` | WhatsApp channel | Twilio WhatsApp sender (E.164, e.g. `+14155238886`) |
| `TWILIO_MOCK` | No | `true` = log only, no real send (default) |

### Vercel production example (WhatsApp)

```
TWILIO_MOCK=false
OTP_DELIVERY_CHANNEL=whatsapp
OTP_LENGTH=6
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
```

### Vercel production example (SMS — alternative)

```
TWILIO_MOCK=false
OTP_DELIVERY_CHANNEL=sms
OTP_LENGTH=6
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_SMS_FROM=+1xxxxxxxxxx
```

Redeploy after saving env vars.

---

## Twilio setup (client checklist)

1. Create account at [twilio.com](https://www.twilio.com)
2. Buy a phone number with **SMS** capability (for `OTP_DELIVERY_CHANNEL=sms`)
3. Copy **Account SID** and **Auth Token** from Console dashboard
4. For trial accounts: verify recipient numbers in Twilio Console → Verified Caller IDs
5. (Optional) Enable WhatsApp in Twilio → use sandbox or approved sender for `whatsapp` channel

---

## API — send-code response

```json
{
  "success": true,
  "data": {
    "message": "Code sent via WhatsApp",
    "phone": "+923216548001",
    "purpose": "register",
    "channel": "whatsapp",
    "expires_in_seconds": 180,
    "resend_available_in_seconds": 60,
    "phone_display": "+92 321 6548001"
  }
}
```

`channel` is `"whatsapp"` (default) or `"sms"` depending on backend config.

> **Flutter:** See **[FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md)** for full mobile integration guide.

---

## Login vs register (send-code)

If client calls send-code with `purpose: "login"` but no account exists:

- OTP is still sent
- Response includes `"purpose": "register"` and `"account_exists": false`
- Client must call **`/auth/register`** (not `/auth/login`) after OTP

---

## Flutter client integration

> **Full guide:** [FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md) — complete Flutter integration with Dart examples, API reference, and checklist.

Summary of required Flutter changes:

**Base URL:** `https://youpass-backend.vercel.app/api/v1`

### No change required

| Item | Notes |
|------|-------|
| Base URL | Same production URL |
| Endpoints | `/auth/send-code`, `/auth/verify-code`, `/auth/login`, `/auth/register` |
| Request body | Same fields: `phone`, `country_code`, `purpose`, `code` |
| Twilio config | Backend only — Flutter never calls Twilio directly |
| Error messages | All API messages are **English**; safe to show `error.message` in SnackBar |

### Required changes

#### 1. Handle `account_exists` after send-code

When the user taps **Login** but has no account, the backend returns **success** (not `USER_NOT_FOUND`):

```json
{
  "success": true,
  "data": {
    "purpose": "register",
    "account_exists": false,
    "channel": "whatsapp",
    "message": "Code sent via WhatsApp. Create your account to continue."
  }
}
```

**Flutter logic:**

```dart
final data = response.data;
final purpose = data['purpose'] as String;
final accountExists = data['account_exists'] as bool?;

if (accountExists == false) {
  // New user — navigate to REGISTER screen
  // After OTP → POST /auth/register (NOT /auth/login)
} else {
  // Existing user — after OTP → POST /auth/login
}

// Store purpose for the next step (verify / login / register)
authState.effectivePurpose = purpose;
```

#### 2. Use `purpose` from send-code response

The OTP is stored under the **effective** purpose returned by the API:

| Response `purpose` | After OTP, call |
|--------------------|-----------------|
| `register` | `POST /auth/register` |
| `login` | `POST /auth/login` |

Do **not** always call `/auth/login` if the user started on the login screen. Use the `purpose` field from the send-code response.

#### 3. Do not call verify-code then login/register with the same code

`/auth/login` and `/auth/register` verify the OTP internally. If you call `/auth/verify-code` first, the code is consumed and login/register will fail.

Choose one flow:

- **Option A:** send-code → OTP screen → login or register  
- **Option B:** send-code → verify-code → (separate step) — not recommended with login/register

### Optional changes

#### Show delivery channel in UI

```json
"channel": "whatsapp"
```

Display *"Code sent via WhatsApp"* or use `data['message']` from the API response.

#### Countries list

- If Flutter loads countries from `GET /config/countries` → **no change** (PK and others come from API)
- If countries are **hardcoded** → add Pakistan (`PK`, dial code `+92`)

#### Remove old error handling

You can remove special handling for `USER_NOT_FOUND` on **send-code** — the backend now sends OTP and returns `account_exists: false` instead.

Handle `USER_NOT_FOUND` only on **login** (e.g. race condition or expired OTP).

### Flutter checklist

| Task | Required? |
|------|-------------|
| Keep same API base URL | — |
| Read `account_exists` after send-code | **Yes** |
| Use response `purpose` for login vs register | **Yes** |
| Update UI text (SMS vs WhatsApp) | Optional |
| Add PK if countries are hardcoded | Only if not using API |
| Remove send-code `USER_NOT_FOUND` handling | Recommended |

### Example flow (login screen, new user)

```
1. User enters phone + PK
2. POST /auth/send-code  { purpose: "login", ... }
3. Response: purpose=register, account_exists=false, channel=whatsapp
4. Show OTP input + registration form
5. POST /auth/register  { phone, country_code, code, full_name, ... }
6. Save access_token from response
```

### Example flow (login screen, existing user)

```
1. POST /auth/send-code  { purpose: "login", ... }
2. Response: purpose=login, account_exists=true
3. Show OTP input
4. POST /auth/login  { phone, country_code, code }
5. Save access_token
```

---

## Mock mode (development)

```env
TWILIO_MOCK=true
OTP_DELIVERY_CHANNEL=whatsapp
```

Console output:

```
[Twilio MOCK/whatsapp] → +923216548001 | AUTH_REGISTER | code=123456 | body="Your YouPass verification code is 123456..."
[DEV OTP] +923216548001 purpose=register code=123456
```

---

## Error codes

| Code | Description |
|------|-------------|
| `OTP_DELIVERY_FAILED` | Twilio API rejected the send (502) |
| `UNSUPPORTED_COUNTRY` | Country not in DB |
| `INVALID_CODE` | Wrong or expired OTP |

---

## What to request from client

| Item | Notes |
|------|-------|
| Twilio Account SID | Console dashboard |
| Twilio Auth Token | Console dashboard |
| Twilio phone number | SMS-enabled, E.164 format |
| Vercel env access | Or they add vars themselves |
| (Optional) WhatsApp sender | Only if using `OTP_DELIVERY_CHANNEL=whatsapp` |

No Meta Business Manager or WhatsApp templates required for SMS.

---

## Quick test

```bash
curl -X POST https://youpass-backend.vercel.app/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"3216548001","country_code":"PK","purpose":"register"}'
```
