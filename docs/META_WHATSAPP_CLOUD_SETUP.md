# Meta WhatsApp Cloud API — Setup (YouPass)

Use this when configuring **Meta for Developers → WhatsApp → Configuration**.

**Production API base:** `https://youpass-backend-two.vercel.app/api/v1`

---

## 1. Webhook (this screen)

Paste into **Configuration → Webhook**:

| Field | Value |
|-------|--------|
| **Callback URL** | `https://youpass-backend-two.vercel.app/api/v1/webhooks/whatsapp` |
| **Verify token** | Same value as Vercel / `.env` → `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |

Then click **Verify and save**.

After it verifies, subscribe to at least:

- `messages`
- `message_template_status_update` (optional but useful)

> The backend must be **deployed** with `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set, or Meta’s verify call will fail.

Leave **Attach a client certificate** **OFF**.

---

## 2. Permanent token + phone number

From **API Setup** / **WhatsApp → API Setup**:

| Meta field | Env var |
|------------|---------|
| Temporary or permanent **Access token** | `WHATSAPP_ACCESS_TOKEN` |
| **Phone number ID** | `WHATSAPP_PHONE_NUMBER_ID` |
| **WhatsApp Business Account ID** | `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| App **App Secret** (Settings → Basic) | `WHATSAPP_APP_SECRET` (optional; enables signature checks) |

Also set:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_MOCK=false
WHATSAPP_API_VERSION=v25.0
WHATSAPP_OTP_TEMPLATE_NAME=youpass_otp
WHATSAPP_OTP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_INVITATION_TEMPLATE_NAME=youpass_invite
WHATSAPP_INVITATION_TEMPLATE_LANGUAGE=en_US
```

Create/approve:

1. **Authentication** OTP template `youpass_otp` (or match `WHATSAPP_OTP_TEMPLATE_NAME`).
2. **Utility** invite template `youpass_invite` — body params `{{1}}` guest, `{{2}}` inviter, `{{3}}` event; URL button `https://youpass.app/claim/{{1}}` (claim token suffix).

```bash
npx tsx scripts/create-meta-whatsapp-otp-template.ts
npx tsx scripts/create-meta-whatsapp-invite-template.ts
```

---

## 3. Vercel

In **Vercel → youpass-backend → Settings → Environment Variables → Production**, set the vars above, then **redeploy**.

Quick verify after deploy:

```bash
curl -i "https://youpass-backend-two.vercel.app/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
# Expect: HTTP 200 and body `test123`
```

---

## 4. Test OTP + invite (real WhatsApp, no autofill)

```bash
# Direct Meta OTP (bypasses auth country gate)
npx tsx scripts/test-meta-whatsapp-otp-send.ts +923205905161

# App path: send-code → WhatsApp → verify/register (no dev_otp_code)
npx tsx scripts/test-auth-e2e-whatsapp-otp.ts
npx tsx scripts/test-auth-whatsapp-otp-full-e2e.ts +923205905161

# Guest invite (requires APPROVED youpass_invite)
npx tsx scripts/test-meta-whatsapp-invite-send.ts +923205905161
```

Flutter debug builds already hit production (`AppConstants.apiBaseUrl`) unless `--dart-define=USE_LOCAL_API=true`. OTP fields are never prefilled from the API.