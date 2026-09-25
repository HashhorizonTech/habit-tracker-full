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
| `FIREBASE_SERVICE_ACCOUNT_JSON` | for push | – | Firebase service-account key: raw JSON **or** a path to the `.json` file (project id read from it). Unset → pushes are skipped silently; the social inbox still works |

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

## Friends, nudges and push (v1.2)

Routes live under `/v1/social/*` and `/v1/push/token` (see the contract). Behaviour worth knowing:

- **Invite codes** are 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, stored without the dash
  (`User.inviteCode`), generated on the first `GET /v1/social/me`. Input is accepted with or
  without the dash and in any case. `GET /v1/social/me` returns the undashed code; the app shows `K7PQ-2MXR`.
- **Register with `inviteCode`**: friendship + `invite_joined` inbox item/push for the inviter, and a
  7-day `trial` entitlement (`note: 'invite reward'`) for both sides — stacked after current Plus —
  while the inviter has < 10 rewarded invites in the last 365 days (`InviteRedemption` is the ledger).
  Unknown codes, disabled inviters and non-string values are ignored; the response always carries
  `inviteReward: boolean`. `rewardsEarned` in `/social/me` is the rolling-365-day count, so
  `rewardsEarned + rewardsLeft = 10`.
- **Requests**: sending to someone who already has a pending request to you accepts theirs instead:
  `201 { autoAccepted: true, request, friend }` (normal case: `201 { autoAccepted: false, request }`).
  Accept → `200 { friend }`; decline/cancel → `204`. Accepted/declined/cancelled requests are deleted.
- **Friendships** are stored once per pair (`userAId < userBId`). Friend names come from the synced
  profile name, falling back to the registration name; emails are never exposed.
- **Cards**: `PUT /v1/social/card` validates sizes (≤ 20 badges, ≤ 30 habits, habit names ≤ 60 chars)
  and is last-write-wins by `updatedAt` (an older card is ignored and the stored one returned).
  Friends get `habits: []` unless the owner set `shareHabitNames: true`.
- **Nudges/cheers**: per sender → receiver per **UTC day**: 1 nudge, 5 cheers (`429 NUDGE_LIMIT`).
  `nudgedToday` uses the same UTC day. The optional `message` must be a preset key of the same kind.
- **Blocks** delete the friendship, pending requests and inbox items between the pair; afterwards
  requests and nudges in either direction get `403 BLOCKED` (same message both ways). Reporting a
  blocked user is allowed. Unblocking does not restore anything.
- **Rate limit**: requests, nudges and reports share 30/min per account (`429 RATE_LIMITED`).
- **Push** (`src/push/fcm.ts`, behind `PushSender`): FCM HTTP v1 with
  `android: { priority: 'high', notification: { channel_id: 'social' } }` and `data: { type, fromName }`;
  notification text is built server-side (`src/push/notifier.ts`). Only tokens registered with
  `kind: 'fcm'` are sent to (Expo tokens are stored but not addressable via FCM). Tokens FCM
  answers with 404/`UNREGISTERED` are deleted. Sends happen after the response (fire-and-forget).
  A user keeps at most 10 tokens (oldest dropped); a token re-registered by another account moves to it.

Setting up push: Firebase console → your project → add the Android app (package `com.tend.app`),
then *Project settings → Service accounts → Generate new private key* and point
`FIREBASE_SERVICE_ACCOUNT_JSON` at the file. The app must create an Android notification channel
with id `social`.

## Admin

The admin API lives under `/v1/admin/*` (see the contract) and needs `role: 'admin'`.
Create the first admin from `server/`:

```sh
npm run admin:create -- you@company.com
```

It promotes an existing account, or creates one and prints a random 16-character
password once. To demote, set `role = 'user'` on the row directly. Every admin write
(grant, revoke, disable, enable, delete, resolve_report) lands in the `AuditLog` table. Set
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
  routes/           health, auth, me (+ /v1/plus), sync, export, billing, admin, social, push
  billing/          Google Play client + mapping (google.ts), verify/RTDN logic (service.ts)
  social/           invite codes + register rewards (invite.ts), friend card schema, social service
  push/             FCM HTTP v1 sender (fcm.ts), notification text + delivery (notifier.ts)
  admin/            admin queries, grants, stats
  cli/              createAdmin.ts (npm run admin:create)
  sync/             record schemas, row mapping, push/pull transaction
  lib/              auth plugin (+ requireAdmin), sessions, plus status, audit, passwords, csv, errors, db
prisma/             schema + committed migrations
test/               vitest suites (app.inject) + fixtures
```
