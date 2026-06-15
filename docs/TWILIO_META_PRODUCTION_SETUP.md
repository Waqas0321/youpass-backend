# Twilio + Meta WhatsApp — Production Setup (All Numbers)

**Backend only.** The Flutter app does not call Twilio or Meta directly. It only calls:

- `POST /api/v1/auth/check-whatsapp`
- `POST /api/v1/auth/send-code`
- `POST /api/v1/auth/login` / `register`

All WhatsApp delivery is handled by the **YOUPASS backend** via Twilio's WhatsApp API (Meta Business account linked in Twilio).

**Production API:** `https://youpass-backend.vercel.app/api/v1`

---

## How it works today

```
Flutter app
  → POST /auth/send-code { phone, country_code, purpose }
  → Backend generates 6-digit OTP (bcrypt hash in MongoDB)
  → Twilio WhatsApp API → Meta → user's WhatsApp app
  → User enters code → POST /auth/login or /register
```

| Layer | Responsibility |
|-------|----------------|
| **Meta Business Manager** | Business verification, WhatsApp Business Account (WABA), message templates |
| **Twilio Console** | WhatsApp sender, Content Template Builder (Content SIDs), API credentials |
| **Vercel env vars** | Credentials + sender + template SIDs |
| **Backend code** | `otp-delivery.service.ts`, `twilio-whatsapp.service.ts`, `twilio-whatsapp.config.ts` |

**Supported countries** are controlled by the `countries` collection in MongoDB (seed includes LATAM + PK). There is **no per-country phone whitelist** in the OTP sender — any active country with a valid mobile WhatsApp number can receive OTPs once production WhatsApp is configured.

---

## Part 1 — Meta Business Manager

1. Go to [business.facebook.com](https://business.facebook.com) and open your **Meta Business account**.
2. Add **WhatsApp** product → create or select a **WhatsApp Business Account (WABA)**.
3. Complete **Business Verification** (required for production messaging to arbitrary numbers).
4. Set display name, category (**Events and Entertainment**), profile photo, and support email (`soporte@youpass.app`).
5. Note your **Meta Business ID** and **WABA ID** (needed when linking in Twilio).

---

## Part 2 — Twilio Premium + link Meta

1. Log in to [Twilio Console](https://console.twilio.com) (Premium/paid account — not trial-only).
2. **Messaging → Senders → WhatsApp senders → Create new sender**.
3. Choose **Use your own Meta Business Manager** (not sandbox-only).
4. Follow Twilio's OAuth flow to connect your Meta WABA.
5. After approval, Twilio assigns a **production WhatsApp sender number** (E.164, e.g. `+15551234567`).
6. Copy from Twilio Console:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
   - **WhatsApp sender number** → `TWILIO_WHATSAPP_FROM`

> **Do not use** `+14155238886` in production — that is the Twilio **sandbox**. Sandbox only works for numbers that sent `join <code>` to the sandbox.

---

## Part 3 — Create & approve WhatsApp templates

Meta requires **pre-approved templates** for outbound OTP messages. Free-form text only works in the sandbox or inside a 24-hour user reply window.

### A. OTP templates (Authentication category)

Create templates in **Meta Business Manager → WhatsApp Manager → Message templates**.

Recommended: one template per language, **Authentication** category, **one variable** `{{1}}` = 6-digit code.

Example (English — must match what you submit to Meta):

```
Your YouPass verification code is {{1}}. Valid for 3 minutes. If you didn't request this, ignore this message.
```

Copy in backend reference: `src/common/constants/whatsapp-templates.ts` (es / pt / en).

Create at minimum:

| Purpose | Suggested template name | Variable |
|---------|-------------------------|----------|
| Login | `youpass_otp_login_en` | `{{1}}` = code |
| Register | `youpass_otp_register_en` | `{{1}}` = code |
| Change phone | `youpass_otp_change_phone_en` | `{{1}}` = code |
| Delete account | `youpass_otp_delete_account_en` | `{{1}}` = code |

You can start with **one approved OTP template** and map it to all purposes via `TWILIO_WHATSAPP_OTP_CONTENT_SID`.

Wait for Meta approval (usually 24–72 hours).

### B. Sync templates to Twilio Content SIDs

1. Twilio Console → **Messaging → Content Template Builder**.
2. Import/sync approved Meta templates (or create Content templates linked to Meta).
3. Each template gets a **Content SID** starting with `HX...`.
4. Copy SIDs into Vercel (see Part 4).

### C. Guest invitation template (Utility category)

For ticket assignment WhatsApp invites (`invitation-delivery.service.ts`):

Variables: `{{1}}` guest name, `{{2}}` inviter, `{{3}}` event, `{{4}}` claim URL.

→ `TWILIO_WHATSAPP_INVITATION_CONTENT_SID`

---

## Part 4 — Vercel environment variables

In **Vercel → youpass-backend → Settings → Environment Variables → Production**:

```env
# Turn OFF mock mode for real WhatsApp delivery
TWILIO_MOCK=false

# Twilio API credentials (same account as WhatsApp sender)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

# Production WhatsApp sender from Twilio (NOT +14155238886 sandbox)
TWILIO_WHATSAPP_FROM=+15551234567

# Required: approved OTP template Content SID(s) from Twilio
TWILIO_WHATSAPP_OTP_CONTENT_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: per-purpose templates (override default OTP SID)
TWILIO_WHATSAPP_TEMPLATE_LOGIN_SID=
TWILIO_WHATSAPP_TEMPLATE_REGISTER_SID=
TWILIO_WHATSAPP_TEMPLATE_PHONE_CHANGE_SID=
TWILIO_WHATSAPP_TEMPLATE_DELETE_ACCOUNT_SID=

# Guest ticket invitations (Utility template)
TWILIO_WHATSAPP_INVITATION_CONTENT_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OTP policy (defaults are fine)
OTP_DELIVERY_CHANNEL=whatsapp
OTP_LENGTH=6
OTP_TTL_MINUTES=3
```

**Redeploy** after saving (`vercel --prod` or push to `main`).

### Startup validation

On boot, the backend logs Twilio mode:

```
[Twilio WhatsApp] mode=LIVE (production sender + templates) from=+1555...
```

If misconfigured:

```
[Twilio WhatsApp] ERROR: Missing TWILIO_WHATSAPP_OTP_CONTENT_SID ...
```

---

## Part 5 — Backend code map (no Flutter changes)

| File | Role |
|------|------|
| `src/config/env.ts` | Env parsing; `TWILIO_MOCK=false` required in production |
| `src/config/twilio-whatsapp.config.ts` | Production vs sandbox detection, template SID helpers, startup checks |
| `src/modules/auth/otp-delivery.service.ts` | Sends OTP via Twilio WhatsApp + Content SID |
| `src/modules/messaging/twilio-whatsapp.service.ts` | Low-level Twilio API, delivery polling |
| `src/modules/messaging/invitation-delivery.service.ts` | Guest invite WhatsApp |
| `src/modules/auth/auth.service.ts` | OTP generation, rate limits, error mapping |
| `src/common/constants/whatsapp-templates.ts` | Template body copy (must align with Meta submissions) |
| `prisma/seed.ts` | Active countries (CL, AR, MX, … PK) — add new countries here + admin |

### Behaviour changes (production sender)

- **Sandbox fallback disabled** in production (`NODE_ENV=production`). No silent retry to `+14155238886`.
- **Production sender requires Content SID** — free-form OTP body is rejected by Meta outside sandbox.
- **`dev_otp_code` is never returned** when `TWILIO_MOCK=false`.
- **All numbers** in an active `countries` row with WhatsApp on the device can receive OTPs (PK, CL, etc.).

---

## Part 6 — Add a new country (backend only)

1. Add row in `prisma/seed.ts` (or via admin when country CRUD exists).
2. Run `npm run db:seed` or insert in MongoDB `countries` collection with `isActive: true`.
3. No Twilio per-country config needed — WhatsApp is global per sender.

---

## Part 7 — Testing

### 1. Check WhatsApp readiness

```bash
curl -s -X POST https://youpass-backend.vercel.app/api/v1/auth/check-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phone":"3216548001","country_code":"PK"}'
```

Expect: `"whatsapp_available": true`, `"message_key": "WHATSAPP_READY"`.

### 2. Send OTP (live)

```bash
curl -s -X POST https://youpass-backend.vercel.app/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"3216548001","country_code":"PK","purpose":"login"}'
```

Expect: `"success": true`, **no** `dev_otp_code` field. Code arrives on WhatsApp.

### 3. Local mock (developers only)

```env
TWILIO_MOCK=true
```

OTP logged to console + `dev_otp_code` in API response. **Never use on public production.**

---

## Part 8 — Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `OTP_DELIVERY_FAILED` 502 | Missing/wrong template SID | Set `TWILIO_WHATSAPP_OTP_CONTENT_SID`, redeploy |
| `OTP_DELIVERY_FAILED` + join sandbox message | Still using sandbox sender | Set real `TWILIO_WHATSAPP_FROM` from Twilio production sender |
| `dev_otp_code` in response | Mock mode on | Set `TWILIO_MOCK=false` |
| Error 63016 | Template not approved | Wait for Meta approval; use Content SID |
| Error 63007 | Sender not in account | Re-link Meta WABA in Twilio |
| Error 63038 | Twilio trial daily limit | Upgrade Twilio account |
| `PHONE_UNSUPPORTED_COUNTRY` | Country inactive in DB | Add/activate in `countries` collection |
| `WHATSAPP_NOT_AVAILABLE` | Landline detected via Twilio Lookup | User must use a mobile WhatsApp number |

Check Vercel function logs for `[OTP delivery failed]` and `[Twilio WhatsApp]` lines.

---

## Part 9 — Checklist before go-live

- [ ] Meta Business verified
- [ ] Twilio WhatsApp sender linked to Meta WABA (not sandbox)
- [ ] OTP Authentication template(s) **Approved** in Meta
- [ ] Content SIDs copied to Vercel
- [ ] `TWILIO_MOCK=false` on Production
- [ ] `TWILIO_WHATSAPP_FROM` = production sender E.164
- [ ] Redeployed backend
- [ ] Tested send-code from PK + CL numbers on real devices
- [ ] Invitation template approved (if using guest WhatsApp invites)

---

## Related docs

- [TWILIO_OTP_IMPLEMENTATION.md](./TWILIO_OTP_IMPLEMENTATION.md) — API endpoints & Flutter summary
- [FLUTTER_AUTH_REGISTRATION_API.md](./FLUTTER_AUTH_REGISTRATION_API.md) — Mobile auth contract (unchanged)

*Backend repo: `youpass-backend` — no Flutter changes required for WhatsApp go-live.*
