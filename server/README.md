# Tend server

Fastify 5 + Prisma 7 (SQLite in dev) backend for the Tend app. The contract is
[`../docs/API.md`](../docs/API.md).

## Run

```sh
cp .env.example .env         # then set JWT_SECRET (see the comment in the file)
npm install                  # also runs `prisma generate`
npm run db:deploy            # create/upgrade the SQLite DB from committed migrations
npm run dev                  # http://localhost:4000, restarts on change
```

| Script | What it does |
|---|---|
| `npm run dev` | Watch mode via `tsx` |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| `npm test` | Vitest; each test file gets a fresh, migrated temp SQLite DB |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate dev` (after editing `prisma/schema.prisma`) + regenerate client |
| `npm run db:deploy` | Apply committed migrations (dev and prod) |
| `npm run db:reset` | Drop and recreate the dev DB |
| `npm run admin:create -- <email>` | Promote an account to admin, or create one (prints a one-time random password) |

The Prisma client is generated into `src/generated/prisma` (git-ignored). Prisma 7
no longer generates on `migrate dev`, so the scripts call `prisma generate` explicitly.

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | – | `file:./dev.db` (relative to `server/`) |
| `JWT_SECRET` | yes | – | ≥ 32 chars; signs 15-minute HS256 access tokens |
| `PORT` | no | `4000` | Listens on `0.0.0.0` |
| `CORS_ORIGIN` | no | `*` | Comma-separated origins, or `*` |
| `LOG_LEVEL` | no | `info` | Pino level |
| `NODE_ENV` | no | `development` | `production` forbids `BILLING_FAKE=true` (the server refuses to start) |
| `GOOGLE_PLAY_PACKAGE_NAME` | no | `com.tend.app` | Android application id |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | for billing | – | Service-account key: raw JSON **or** a path to the `.json` file. Unset → verify answers `503 BILLING_NOT_CONFIGURED` |
| `GOOGLE_RTDN_SECRET` | for RTDN | – | Shared secret in the Pub/Sub push URL `?token=`. Unset → every RTDN push gets `401` |
| `BILLING_FAKE` | no | `false` | Dev only: accept `fake:<monthly\|yearly\|lifetime>:<random>` tokens |
| `PRICE_MONTHLY_INR` / `PRICE_YEARLY_INR` / `PRICE_LIFETIME_INR` | no | `99` / `699` / `1999` | List prices for the admin revenue estimate |

`.env` is loaded by `src/server.ts` and `prisma.config.ts`; it is git-ignored.

## Plus and Google Play Billing

A user has Plus while one of their entitlements is `active`/`grace` and not expired (a
Play subscription the user cancelled — `canceled` — keeps Plus until its paid period
ends). Lifetime beats everything, otherwise the latest expiry wins
(`computePlusStatus` in `src/lib/plus.ts`).

Setting up real billing:

1. Play Console: create subscription `plus` with base plans `monthly` and `yearly`
   (yearly gets a 7-day free-trial offer — include "trial" in its offer id), and the
   one-time product `plus_lifetime`.
2. Google Cloud: enable the *Google Play Android Developer API*, create a service
   account + JSON key, then in Play Console → *Users and permissions* invite the
   service-account email with *View financial data* and *Manage orders and subscriptions*.
   Point `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` at the key file (or paste the JSON).
3. Real-time developer notifications: create a Pub/Sub topic, grant
   `google-play-developer-notifications@system.gserviceaccount.com` *Pub/Sub Publisher*
   on it, set it in Play Console → *Monetization setup*, and add a **push** subscription
   to `https://<host>/v1/billing/google/rtdn?token=<GOOGLE_RTDN_SECRET>`.

`src/billing/google.ts` talks to the Android Publisher v3 REST API with plain `fetch`
(auth via `google-auth-library`) behind the `GooglePlayApi` interface, so tests inject a fake.
Verified purchases are acknowledged by the server. Entitlements that were `revoked` by
an admin or `refunded` (voided purchase) are never re-activated by later Google state.

**Fake mode** (`BILLING_FAKE=true`, dev only): `POST /v1/billing/google/verify` accepts
`fake:monthly:<anything>` / `fake:yearly:<anything>` (with `productId: "plus"`,
`type: "subscription"`; 30/365-day expiry) and `fake:lifetime:<anything>` (with
`productId: "plus_lifetime"`, `type: "inapp"`). Each distinct token is one purchase;
re-verifying the same token is a no-op. Never enable it in production — the server
refuses to start with `NODE_ENV=production`.

## Admin

The admin API lives under `/v1/admin/*` (see the contract) and needs `role: 'admin'`.
Create the first admin from `server/`:

```sh
npm run admin:create -- you@company.com
```

It promotes an existing account, or creates one and prints a random 16-character
password once. To demote, set `role = 'user'` on the row directly. Every admin write
(grant, revoke, disable, enable, delete) lands in the `AuditLog` table. Set
`CORS_ORIGIN` to include the admin panel's origin (e.g.
`CORS_ORIGIN="http://localhost:5173,https://admin.example.com"`).

## Reaching it from the Android emulator

```sh
adb reverse tcp:4000 tcp:4000
```

The app can then use `http://localhost:4000`. (Without `adb reverse`, the emulator
sees the host as `http://10.0.2.2:4000`.) For a physical device on the same Wi‑Fi,
use the Mac's LAN IP — the server already binds to `0.0.0.0`.

## Switching to Postgres

The schema avoids SQLite-only features (JSON-shaped fields are `TEXT`, timestamps
are `Float` ms, no enums), so the switch is mechanical:

1. `npm i @prisma/adapter-pg`
2. In `prisma/schema.prisma`, set `provider = "postgresql"`.
3. In `src/lib/db.ts`, replace `PrismaBetterSqlite3` with
   `new PrismaPg({ connectionString: databaseUrl })` from `@prisma/adapter-pg`.
4. Migrations are provider-specific: move `prisma/migrations` aside and run
   `npm run db:migrate -- --name init` against the new database to create a
   Postgres baseline, then `npm run db:deploy` in each environment.
5. `DATABASE_URL="postgresql://user:pass@host:5432/tend"`.

Tests are written against SQLite; point `test/helpers.ts` at a throwaway Postgres
database if you want to run them there.

## Layout

```
src/
  app.ts            buildApp() factory (used by tests)
  server.ts         entry point: env, listen, graceful shutdown
  env.ts            zod-validated environment
  routes/           health, auth, me (+ /v1/plus), sync, export, billing, admin
  billing/          Google Play client + mapping (google.ts), verify/RTDN logic (service.ts)
  admin/            admin queries, grants, stats
  cli/              createAdmin.ts (npm run admin:create)
  sync/             record schemas, row mapping, push/pull transaction
  lib/              auth plugin (+ requireAdmin), sessions, plus status, audit, passwords, csv, errors, db
prisma/             schema + committed migrations
test/               vitest suites (app.inject) + fixtures
```
