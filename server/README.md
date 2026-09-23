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

`.env` is loaded by `src/server.ts` and `prisma.config.ts`; it is git-ignored.

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
  routes/           health, auth, me, sync, export
  sync/             record schemas, row mapping, push/pull transaction
  lib/              auth plugin, sessions (refresh tokens), passwords, csv, errors, db
prisma/             schema + committed migrations
test/               vitest suites (app.inject) + fixtures
```
