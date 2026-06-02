# YOUPASS Backend — YouAccess Auth API

Node.js + Express + TypeScript + MongoDB Atlas (Prisma)  
Twilio SMS/WhatsApp OTP authentication per YOUPASS master document v23.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| ORM | Prisma + MongoDB |
| Validation | Zod |
| Auth | JWT + bcrypt OTP hashes |
| Deployment | Vercel serverless |

## Production

**Live API:** https://youpass-backend.vercel.app/api/v1

| Check | URL |
|-------|-----|
| Health | `/api/v1/health` |
| DB health | `/api/v1/health/db` |
| Countries | `/api/v1/config/countries` |

## Project structure

```
api/index.ts          # Vercel serverless entry
src/
├── config/           # env, database, constants
├── common/           # middleware, errors, utils, types
├── modules/
│   ├── auth/         # YouAccess — OTP, login, register, sessions
│   ├── config/       # Countries, currency, language, payment gateway
│   ├── users/        # Profile, welcome data, logout
│   └── home/         # Initial feed (stub)
├── app.ts
└── server.ts
prisma/
├── schema.prisma     # Full auth + user schema
└── seed.ts           # LATAM countries
public/index.html     # Static landing page (Vercel)
```

## Quick start (local)

### 1. Prerequisites

- Node.js 20+
- MongoDB Atlas cluster

### 2. Install

```bash
cp .env.example .env
npm install
```

Edit `.env` and set `DATABASE_URL` and `JWT_SECRET` (min 16 chars).

### 3. Database

```bash
npm run db:push
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

API base: `http://localhost:3000/api/v1`

In development, OTP codes are printed to the console when `TWILIO_MOCK=true`.

## Deploy to Vercel

### 1. MongoDB Atlas network access

Vercel uses dynamic IPs. In [MongoDB Atlas](https://cloud.mongodb.com):

1. **Network Access** → **Add IP Address**
2. Choose **Allow Access from Anywhere** (`0.0.0.0/0`)

Without this step, production DB requests will time out.

### 2. Environment variables (Vercel)

Set these in the Vercel project dashboard or via CLI:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB Atlas connection string (include `/youpass` database name) |
| `JWT_SECRET` | Long random secret (min 16 chars) |
| `API_PREFIX` | `/api/v1` |
| `OTP_DELIVERY_CHANNEL` | `sms` or `whatsapp` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_SMS_FROM` | Twilio phone number for SMS (E.164) |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender (E.164, if using whatsapp channel) |
| `TWILIO_MOCK` | `true` until Twilio is configured |

### 3. Deploy

```bash
npx vercel --prod
```

Build runs `prisma generate && tsc` automatically via `vercel-build` script.

---

## Twilio OTP implementation

See **[docs/TWILIO_OTP_IMPLEMENTATION.md](./docs/TWILIO_OTP_IMPLEMENTATION.md)** for backend Twilio setup.

See **[docs/FLUTTER_IMPLEMENTATION.md](./docs/FLUTTER_IMPLEMENTATION.md)** for **Flutter app integration** (send-code, register, login, 6-digit OTP, error handling).

## Auth API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/send-code` | — | Send OTP via SMS or WhatsApp (Twilio) |
| POST | `/auth/resend-code` | — | Resend OTP (60s cooldown, max 5/h) |
| POST | `/auth/verify-code` | — | Verify OTP without creating session |
| POST | `/auth/check-whatsapp` | — | Check WhatsApp availability |
| POST | `/auth/login` | — | Login existing user (OTP → JWT) |
| POST | `/auth/register` | — | Create account (OTP → JWT) |
| POST | `/auth/logout` | Bearer | Revoke current session |
| POST | `/auth/delete-account/request` | Bearer | Send OTP to confirm deletion |
| POST | `/auth/delete-account/verify` | Bearer | Verify OTP and delete account |
| POST | `/auth/change-phone/request` | Bearer | OTP to new number |
| POST | `/auth/change-phone/verify` | Bearer | Confirm phone change |

## Config endpoints

| Method | Endpoint |
|--------|----------|
| GET | `/config/countries` |
| GET | `/config/currency/:country` |
| GET | `/config/language/:country` |
| GET | `/config/payment-gateway/:country` |

## User endpoints (authenticated)

| Method | Endpoint |
|--------|----------|
| GET | `/users/me` |
| GET | `/users/me/profile` |
| GET | `/users/me/welcome-data` |
| GET | `/users/me/profile-completeness` |
| POST | `/users/me/logout` |
| POST | `/users/me/delete-account/request` |
| POST | `/users/me/delete-account/verify` |
| GET | `/home/initial-feed` |

---

## Example flows

### Register

```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"912345678","country_code":"CL","purpose":"register"}'

# 2. Register (use OTP from console in dev)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone":"912345678",
    "country_code":"CL",
    "code":"123456",
    "full_name":"Christian Pérez",
    "rut_or_passport":"12345678-9",
    "email":"christian@email.com",
    "birthdate":"1995-06-15",
    "gender":"male",
    "accept_terms": true
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"912345678","country_code":"CL","purpose":"login"}'

curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"912345678","country_code":"CL","code":"123456"}'
```

Use `Authorization: Bearer <access_token>` for protected routes.

---

## Database schema (auth)

- `users` — accounts (phone unique, profile, category)
- `auth_codes` — OTP hashes (3 min TTL, single use)
- `auth_attempts` — verification audit
- `auth_rate_limits` — resend + brute-force limits
- `user_sessions` — JWT sessions
- `user_profile_completion` — profile banner state
- `countries` — LATAM config (seeded)

## Twilio production

Set in Vercel (or `.env`):

```
TWILIO_MOCK=false
OTP_DELIVERY_CHANNEL=sms
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_SMS_FROM=+1234567890
```

For WhatsApp OTP instead of SMS:

```
OTP_DELIVERY_CHANNEL=whatsapp
TWILIO_WHATSAPP_FROM=+14155238886
```

See [docs/TWILIO_OTP_IMPLEMENTATION.md](./docs/TWILIO_OTP_IMPLEMENTATION.md) for full setup.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run db:push` | Sync schema to DB |
| `npm run db:migrate` | Create migration |
| `npm run db:seed` | Seed countries |
| `npm run db:studio` | Prisma Studio |
