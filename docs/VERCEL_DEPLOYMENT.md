# YouPass Backend — Vercel Deployment

Use this guide whenever you redeploy the API to production.

---

## Production URLs

| Service | URL |
|---------|-----|
| **API base** | `https://youpass-backend-two.vercel.app/api/v1` |
| **Health** | `https://youpass-backend-two.vercel.app/api/v1/health` |
| **Admin panel** | `https://youpass-backend-two.vercel.app/admin` |
| **Vercel dashboard** | https://vercel.com/usama-mukhtiars-projects/youpass-backend |

The Flutter app (`youpass`) uses this base URL in release builds via `AppConstants.apiBaseUrl`.

---

## Vercel account (do not change unless intentional)

| Field | Value |
|-------|--------|
| Vercel user | `uasdevelop` |
| Team | **Usama Mukhtiar's projects** (`usama-mukhtiars-projects`) |
| Project name | `youpass-backend` |
| GitHub repo | `Waqas0321/youpass-backend` |

Log in before deploying:

```bash
vercel whoami
# Expected: uasdevelop
```

Link the repo once per machine (already done if `.vercel/project.json` exists):

```bash
cd youpass-backend
vercel link --yes --project youpass-backend
```

---

## Prerequisites

1. **Node.js** ≥ 20
2. **Vercel CLI:** `npm i -g vercel`
3. Local **`.env`** with at least:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - Twilio vars (if real WhatsApp OTP is required)
4. Build passes locally:

```bash
npm run vercel-build
```

---

## First-time setup (new machine)

```bash
cd youpass-backend
vercel login
vercel link --yes --project youpass-backend
```

Sync environment variables from local `.env` to Vercel **Production**:

```bash
chmod +x scripts/sync-vercel-env.sh
./scripts/sync-vercel-env.sh
```

The script:

- Uploads every non-empty key from `.env`
- Skips `PORT` (Vercel sets this)
- Skips empty values (Twilio, Stripe, etc. if not filled locally)
- Forces `NODE_ENV=production`
- Forces `TWILIO_MOCK=false` at the end (override manually if you need mock OTP)

To enable **mock OTP** on production (no Twilio credentials yet):

```bash
printf 'true' | vercel env add TWILIO_MOCK production --force --yes
```

---

## Redeploy to production (usual workflow)

From `youpass-backend`:

```bash
# 1. Ensure build works
npm run vercel-build

# 2. Deploy
vercel deploy --prod --yes
```

After deploy, verify:

```bash
curl -s https://youpass-backend-two.vercel.app/api/v1/health
# {"success":true,"data":{"status":"ok","service":"youpass-api"}}
```

---

## Environment variables

### List current production vars

```bash
vercel env ls production
```

### Add or update one variable

```bash
printf 'your-value' | vercel env add VARIABLE_NAME production --force --yes
```

Then **redeploy** — env changes do not apply to running deployments until you deploy again:

```bash
vercel deploy --prod --yes
```

### Re-sync all vars from `.env`

```bash
./scripts/sync-vercel-env.sh
vercel deploy --prod --yes
```

### Required for a working API

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MongoDB Atlas connection string |
| `JWT_SECRET` | Auth tokens (min 16 chars) |
| `NODE_ENV` | `production` |
| `API_PREFIX` | `/api/v1` |

### Required for real WhatsApp OTP

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Production WhatsApp sender (E.164) |
| `TWILIO_WHATSAPP_OTP_CONTENT_SID` | Approved OTP template Content SID |
| `TWILIO_MOCK` | `false` in production |

See also: [TWILIO_OTP_IMPLEMENTATION.md](./TWILIO_OTP_IMPLEMENTATION.md)

---

## Build notes (important)

`NODE_ENV=production` on Vercel makes `npm install` skip devDependencies. The project needs TypeScript types at build time, so `vercel.json` forces dev installs:

```json
"installCommand": "NODE_ENV=development npm install && npm run admin:install",
"buildCommand": "NODE_ENV=development npm run vercel-build"
```

Do **not** remove these unless you move `@types/*` into `dependencies`.

---

## Flutter app alignment

Release builds read production URL from:

```
youpass/lib/core/constants/app_constants.dart
→ _productionApiBaseUrl = 'https://youpass-backend-two.vercel.app'
```

Debug builds still use local backend only when started with:

```bash
flutter run --dart-define=USE_LOCAL_API=true
```

Override for a physical device on LAN:

```bash
flutter run --dart-define=API_BASE_URL=http://YOUR_LAN_IP:3002
```

After changing the production URL, rebuild the Flutter app (hot restart is not enough for release).

---

## Admin panel

Built during `vercel-build` and served at `/admin`.

Open: https://youpass-backend-two.vercel.app/admin

Uses `ADMIN_API_KEY` from Vercel env vars.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `FUNCTION_INVOCATION_FAILED` | Missing env vars → run `sync-vercel-env.sh` and redeploy |
| Build fails: `Could not find @types/express` | Ensure `vercel.json` uses `NODE_ENV=development` for install/build |
| `DATABASE_UNAVAILABLE` | Check `DATABASE_URL`; allow Vercel IPs in MongoDB Atlas |
| OTP not sent | Set Twilio vars or `TWILIO_MOCK=true` for mock mode |
| Flutter still hits old URL | Rebuild app; check `AppConstants.apiBaseUrl` |

### Inspect last deployment

```bash
vercel inspect youpass-backend-two.vercel.app
```

### View deployment logs

Vercel dashboard → Project → Deployments → select deployment → **Functions** / **Build Logs**

---

## Quick reference

```bash
# Login & link
vercel login
vercel link --yes --project youpass-backend

# Sync env + deploy
./scripts/sync-vercel-env.sh
vercel deploy --prod --yes

# Smoke test
curl -s https://youpass-backend-two.vercel.app/api/v1/health
```

---

*Last updated: production project `youpass-backend` on Usama Mukhtiar's Vercel team.*
