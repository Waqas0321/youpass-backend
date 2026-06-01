# Twilio OTP — Implementation Guide

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

YOUPASS sends OTP codes via **Twilio** (SMS or WhatsApp). Meta WhatsApp Business API is **not** used.

---

## Overview

- 6-digit OTP, bcrypt-hashed in MongoDB
- 3-minute TTL, single-use codes
- Delivery channel configurable: **`sms`** (default) or **`whatsapp`**
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
| `OTP_DELIVERY_CHANNEL` | No | `sms` (default) or `whatsapp` |
| `TWILIO_ACCOUNT_SID` | Live mode | From [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Live mode | Twilio auth token |
| `TWILIO_SMS_FROM` | SMS channel | Your Twilio phone number (E.164, e.g. `+12025551234`) |
| `TWILIO_WHATSAPP_FROM` | WhatsApp channel | Twilio WhatsApp sender (E.164, e.g. `+14155238886`) |
| `TWILIO_MOCK` | No | `true` = log only, no real send (default) |

### Vercel production example (SMS — recommended for Pakistan)

```
TWILIO_MOCK=false
OTP_DELIVERY_CHANNEL=sms
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
    "message": "Código enviado por SMS",
    "phone": "+923216548001",
    "purpose": "register",
    "account_exists": false,
    "channel": "sms",
    "expires_in_seconds": 180,
    "resend_available_in_seconds": 60,
    "phone_display": "+92 321 6548001"
  }
}
```

`channel` is `"sms"` or `"whatsapp"` depending on config.

---

## Login vs register (send-code)

If client calls send-code with `purpose: "login"` but no account exists:

- OTP is still sent
- Response includes `"purpose": "register"` and `"account_exists": false`
- Client must call **`/auth/register`** (not `/auth/login`) after OTP

---

## Mock mode (development)

```env
TWILIO_MOCK=true
OTP_DELIVERY_CHANNEL=sms
```

Console output:

```
[Twilio MOCK/sms] → +923216548001 | AUTH_REGISTER | code=123456 | body="Your YouPass code is 123456..."
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
