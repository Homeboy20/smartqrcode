# Copilot Instructions (smartqrcode)

## Project snapshot
- Framework: Next.js (App Router) + React 18 + TypeScript
- Styling/UI: Tailwind CSS, Chakra UI, Radix Slot
- Backend integrations: Supabase (DB/auth/admin), Firebase (some features), payment providers (Paystack/Flutterwave/Stripe/PayPal)
- Deployment target: **standard Next.js server runtime (Node.js)**. This repo is **not** intended for static export.

## How to run
- Dev: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Start (prod): `npm start`

Notes:
- `npm start` uses `scripts/start.js` which prefers `.next/standalone/server.js` if present (Docker/Coolify friendly) and falls back to `next start`.

## Coding conventions
- Prefer small, focused changes. Keep public APIs stable.
- Use existing patterns under `src/app` (pages + route handlers) and `src/lib` (shared logic).
- Path alias `@/` is used for imports.
- App Router API routes live under `src/app/api/**/route.ts` and should return JSON via `NextResponse.json(...)`.

## Deployment/runtime constraints
- **Do not add or reintroduce static export** (`next export`, `output: 'export'`, `out/`-based deploy flows). Static export breaks `/api/*` POST endpoints.
- `next.config.js` is configured for `output: 'standalone'` and `trailingSlash: false` to avoid POST redirect issues on some hosts.

## Environment variables (high level)
- Supabase:
  - Client: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Server/admin: `SUPABASE_SERVICE_ROLE_KEY`
- Credential encryption (required if using admin-stored payment credentials):
  - `CREDENTIALS_ENCRYPTION_KEY` or `CREDENTIALS_ENCRYPTION_KEYS` (optionally rotation keys)

Never hardcode secrets. Update `.env.example` when introducing new env vars.

## Payments/checkout notes
- Checkout is created via the App Router endpoint `/api/checkout/create-session`.
- If the UI sees non-JSON responses (e.g. “Cannot POST …”), it usually means the app is not running as a Next.js server.
- Payment provider credentials are stored in Supabase (encrypted). If decryption keys are missing at runtime, providers may appear unavailable.

## When editing build tooling
- Keep `package.json` scripts aligned to a normal Next server app:
  - `build` must run `next build`
  - `start` must run the Next server (`next start` or standalone server)
- Avoid adding host-specific deployment artifacts unless explicitly requested.
