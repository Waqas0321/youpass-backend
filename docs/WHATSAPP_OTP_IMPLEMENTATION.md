# WhatsApp OTP — Implementation Guide

This document describes how the YOUPASS YouAccess WhatsApp OTP flow is implemented, how to integrate it from a client app, and how it was verified in production.

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

---

## Overview

Authentication uses a 6-digit OTP sent via WhatsApp (Meta Business API). Codes are:

- Hashed with bcrypt before storage (never stored in plain text)
- Valid for **3 minutes** (configurable via `OTP_TTL_MINUTES`)
- Single-use (marked with `usedAt` after successful verification)
- Rate-limited for resends and failed attempts

Supported purposes:
| Purpose | Use case |
|---------|----------|
| `register` | New account signup |
| `login` | Existing user login |
| `change_phone` | Phone number change (authenticated) |
| `delete_account` | Account deletion flow |

---

## Architecture

```
Client App
    │
    ├─ POST /auth/send-code      ──► Validate phone → Generate OTP → Save hash → WhatsApp send
    ├─ POST /auth/resend-code    ──► Same as send (with cooldown + hourly limit)
    ├─ POST /auth/verify-code    ──► Lookup active code → bcrypt compare → Mark used
    ├─ POST /auth/login          ──► verify-code logic + issue JWT session
    └─ POST /auth/register       ──► verify-code logic + create user + issue JWT
```

### Key files

| File | Role |
|------|------|
| `src/modules/auth/auth.routes.ts` | Route definitions |
| `src/modules/auth/auth.controller.ts` | HTTP handlers |
| `src/modules/auth/auth.service.ts` | OTP business logic |
| `src/modules/auth/whatsapp.service.ts` | Meta API / mock sender |
| `src/modules/auth/auth.validators.ts` | Zod request schemas |
| `src/config/constants.ts` | WhatsApp template names, error codes |
| `src/config/env.ts` | OTP + WhatsApp environment config |

---

## API reference

All responses use this envelope:

**Success**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { }
  }
}
```

---

### 1. Send OTP

`POST /auth/send-code`

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | National number (e.g. `"912345678"`) |
| `country_code` | string | Yes | ISO country code (e.g. `"CL"`) |
| `purpose` | string | Yes | `register`, `login`, `change_phone`, or `delete_account` |

**Example**
```bash
curl -X POST https://youpass-backend.vercel.app/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "912345678",
    "country_code": "CL",
    "purpose": "register"
  }'
```

**Success response (200)**
```json
{
  "success": true,
  "data": {
    "message": "Código enviado por WhatsApp",
    "phone": "+56912345678",
    "purpose": "register",
    "channel": "whatsapp",
    "expires_in_seconds": 180,
    "resend_available_in_seconds": 60,
    "phone_display": "+56 9 1234 5678"
  }
}
```

**Business rules**

- `register`: fails with `USER_EXISTS` if phone already registered
- `login`: fails with `USER_NOT_FOUND` if no account exists
- Phone must belong to an active supported country (seeded in `countries` table)

---

### 2. Resend OTP

`POST /auth/resend-code`

Same request body as send-code.

**Limits**

| Rule | Default |
|------|---------|
| Cooldown between resends | 60 seconds |
| Max resends per hour | 5 |

**Cooldown error (429)**
```json
{
  "success": false,
  "error": {
    "code": "RESEND_COOLDOWN",
    "message": "Reenviar código en 51 segundos",
    "details": { "retry_after_seconds": 51 }
  }
}
```

---

### 3. Verify OTP

`POST /auth/verify-code`

Verifies the code without creating a session. Use this for a standalone OTP step in the UI, or rely on `/auth/login` and `/auth/register` which verify internally.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Same number used in send-code |
| `country_code` | string | Yes | Same country code |
| `code` | string | Yes | 6-digit numeric code |
| `purpose` | string | Yes | Same purpose as send-code |

**Example**
```bash
curl -X POST https://youpass-backend.vercel.app/api/v1/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "912345678",
    "country_code": "CL",
    "code": "123456",
    "purpose": "register"
  }'
```

**Success response (200)**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "phone": "+56912345678",
    "purpose": "register",
    "message": "Código verificado correctamente"
  }
}
```

**Verify error messages**

| Message | Meaning |
|---------|---------|
| `Código inválido` | No active OTP found for this phone/purpose |
| `Código incorrecto` | OTP found but wrong digits |
| `El código expiró. Solicita uno nuevo.` | OTP expired (> 3 min) |

After **3 failed attempts**, the phone is blocked for **15 minutes** (`BLOCKED` error).

---

### 4. Check WhatsApp availability (optional)

`POST /auth/check-whatsapp`

```json
{
  "phone": "912345678",
  "country_code": "CL"
}
```

Returns `whatsapp_available: true/false`. In mock mode this always returns `true`.

---

## Client integration flow

### Registration

```
1. User enters phone + country
2. POST /auth/send-code  { purpose: "register" }
3. User enters 6-digit code from WhatsApp
4. POST /auth/register   { phone, country_code, code, full_name, ... }
5. Store access_token from response; use Authorization: Bearer <token>
```

### Login

```
1. POST /auth/send-code  { purpose: "login" }
2. POST /auth/login      { phone, country_code, code }
3. Store access_token
```

### OTP-only screen (verify before register/login)

```
1. POST /auth/send-code
2. POST /auth/verify-code   ← optional pre-check
3. POST /auth/register or /auth/login
```

> **Note:** `/auth/login` and `/auth/register` verify the OTP again. If you call `/auth/verify-code` first, the code is consumed and login/register will fail. Choose either a standalone verify step **or** verify inside login/register — not both with the same code.

---

## WhatsApp configuration

### Development (mock mode)

Set in `.env`:

```env
WHATSAPP_MOCK=true
```

OTP is **not** sent to WhatsApp. The code is printed in the local server console:

```
[WhatsApp MOCK] → +56912345678 | template=AUTH_REGISTER | code=123456 | lang=es
[DEV OTP] +56912345678 purpose=register code=123456
```

### Production (live WhatsApp)

Set in Vercel environment variables:

```env
WHATSAPP_MOCK=false
WHATSAPP_PHONE_NUMBER_ID=<meta_phone_number_id>
WHATSAPP_ACCESS_TOKEN=<meta_permanent_token>
WHATSAPP_API_URL=https://graph.facebook.com/v21.0
```

Approved Meta templates (must exist in Business Manager):

| Purpose | Template name |
|---------|---------------|
| login | `AUTH_LOGIN` |
| register | `AUTH_REGISTER` |
| change_phone | `AUTH_PHONE_CHANGE` |
| delete_account | `AUTH_DELETE_ACCOUNT` |

Each template must include one body parameter: the 6-digit OTP code.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTP_LENGTH` | `6` | Code length |
| `OTP_TTL_MINUTES` | `3` | Expiry time |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Min wait before resend |
| `OTP_MAX_RESENDS_PER_HOUR` | `5` | Hourly resend cap |
| `OTP_MAX_FAILED_ATTEMPTS` | `3` | Attempts before block |
| `OTP_BLOCK_MINUTES` | `15` | Block duration after max failures |
| `WHATSAPP_MOCK` | `true` | Use mock sender when not `false` |

---

## MongoDB fix (verify OTP)

**Issue:** Prisma + MongoDB does not match documents where optional fields are *missing* when filtering with `usedAt: null`. New OTP records are created without a `usedAt` field, so verify could never find them.

**Fix** (`auth.service.ts`):

```typescript
function whereAuthCodeUnused() {
  return { OR: [{ usedAt: null }, { usedAt: { isSet: false } }] };
}
```

Used in:

- `verifyOtpCode` — find active OTP
- `invalidatePreviousCodes` — invalidate on resend

---

## Deployment

Deploy to Vercel:

```bash
npx vercel --prod
```

Build command: `prisma generate && tsc` (via `vercel-build` script).

Ensure MongoDB Atlas allows Vercel IPs (`0.0.0.0/0` in Network Access).

---

## Production test results

**Deployment:** `https://youpass-backend.vercel.app`  
**Tested:** June 1, 2026  
**Deployment ID:** `dpl_HcUBPwT3DuHsE5ig7H4ipTkFYeAZ`

| Test | Endpoint | Result |
|------|----------|--------|
| API health | `GET /health` | ✅ `status: ok` |
| Database | `GET /health/db` | ✅ `database: connected` |
| Send OTP | `POST /auth/send-code` | ✅ Returns success + expiry metadata |
| Verify lookup | `POST /auth/verify-code` (wrong code) | ✅ Returns `Código incorrecto` (code found in DB) |
| Resend cooldown | `POST /auth/resend-code` (within 60s) | ✅ Returns `RESEND_COOLDOWN` with `retry_after_seconds` |

The verify lookup test confirms the MongoDB `usedAt` fix is live: before the fix, a wrong code returned `Código inválido` (no record found). After the fix, it returns `Código incorrecto` (record found, hash mismatch).

---

## Error codes reference

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_PHONE` | 400 | Phone format invalid |
| `UNSUPPORTED_COUNTRY` | 400 | Country not active |
| `INVALID_CODE` | 400 | Wrong or missing OTP |
| `CODE_EXPIRED` | 400 | OTP past TTL |
| `USER_NOT_FOUND` | 404 | Login on unknown phone |
| `USER_EXISTS` | 409 | Register on existing phone |
| `RESEND_COOLDOWN` | 429 | Resend too soon |
| `MAX_RESENDS` | 429 | Hourly resend limit |
| `BLOCKED` | 429 | Too many failed attempts |
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |

---

## Database tables (auth)

| Table | Purpose |
|-------|---------|
| `auth_codes` | OTP hashes, expiry, purpose, WhatsApp template |
| `auth_attempts` | Audit log per verification try |
| `auth_rate_limits` | Resend counters, failed attempts, blocks |
| `user_sessions` | JWT sessions after login/register |

---

## Quick local test

```bash
# Terminal 1
npm run dev

# Terminal 2 — send
curl -X POST http://localhost:3000/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"912345678","country_code":"CL","purpose":"register"}'

# Copy code from server console, then verify
curl -X POST http://localhost:3000/api/v1/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"912345678","country_code":"CL","code":"XXXXXX","purpose":"register"}'
```
