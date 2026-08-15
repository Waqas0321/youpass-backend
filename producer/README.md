# YouPass Producer Dashboard

Staff-only dashboard for producers managing events on YouPass. Accessible via official email and password.

## Stack

- React 18 + TypeScript
- Vite 6
- React Router 6

## Scripts

From repo root:

```bash
npm run producer:install   # first time
npm run producer:dev         # http://localhost:5175/producer/
npm run producer:build       # output → public/producer/
```

From this folder:

```bash
npm install
npm run dev
npm run build
```

## Directory structure

```
src/
├── app/           # App shell, providers, route definitions
├── api/           # HTTP client + API modules (auth, events, …)
├── auth/          # Session storage + route guards
├── config/        # Environment helpers
├── i18n/          # EN / ES strings
├── layouts/       # Page layouts (auth, dashboard shell)
├── pages/         # Route-level screens (login, home, …)
├── components/    # Shared UI (ui/, future: dashboard/, events/)
├── features/      # Feature modules (add per domain: events, tickets, …)
├── hooks/         # Shared hooks
├── styles/        # Global CSS (tokens, login, layout)
└── types/         # Shared TypeScript types
```

## Environment

Copy `.env.development.example` to `.env.development`:

- `VITE_API_BASE_URL` — backend API (default proxies to `localhost:3002` in dev)

## Auth (current)

Login is **design-only**: validates email format and simulates success. Wire `src/api/auth.api.ts` to the real producer auth endpoint when the backend is ready.
