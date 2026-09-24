# Tend API contract (v1)

Shared contract between the Expo app (`app/`) and the Node server (`server/`).
The app is **offline-first**: every write lands in the local store first and is
pushed to the server by the sync engine. The server is the durable backup and
the source for other devices.

- Base URL: `http://<host>:4000` (Android emulator reaches the Mac via `adb reverse tcp:4000 tcp:4000` → `http://localhost:4000`).
- JSON everywhere. Errors: `{ "error": { "code": "STRING_CODE", "message": "Human text" } }` with a proper HTTP status.
- Auth: `Authorization: Bearer <accessToken>` on every route except `/health` and `/v1/auth/*`.
- Timestamps: epoch **milliseconds** (numbers). Dates: `YYYY-MM-DD` strings in the user's local calendar.

## Health
`GET /health` → `200 { "ok": true, "version": "1.0.0" }`

## Auth
| Route | Body | Response |
|---|---|---|
| `POST /v1/auth/register` | `{ email, password, name }` | `201 { user, accessToken, refreshToken }` |
| `POST /v1/auth/login` | `{ email, password }` | `200 { user, accessToken, refreshToken }` |
| `POST /v1/auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` (rotates; the old token is revoked) |
| `POST /v1/auth/logout` | `{ refreshToken }` | `204` |

- `user` = `{ id, email, name, createdAt }`.
- Password: 8–128 chars. Email is normalised to lower case. Duplicate email → `409 EMAIL_TAKEN`. Bad credentials → `401 INVALID_CREDENTIALS` (same message for unknown email and wrong password).
- Access token: JWT, 15 min. Refresh token: opaque random string, 60 days, stored hashed server-side.
- Login/register are rate-limited (10/min per IP) → `429 RATE_LIMITED`.

## Account
- `GET /v1/me` → `{ user, profile }`
- `DELETE /v1/me` → `204` (deletes the account and all data)

## Sync
`POST /v1/sync`

```jsonc
// request
{
  "cursor": 0,                 // last cursor the device received; 0 on first sync
  "changes": {                 // records changed locally since the last successful push (may be empty arrays)
    "habits": [Habit], "habitLogs": [HabitLog], "tasks": [Task],
    "focusSessions": [FocusSession], "moodLogs": [MoodLog], "badges": [BadgeState],
    "profile": Profile | null
  }
}
// response
{
  "cursor": 42,                // new cursor to store on the device
  "changes": { ...same shape: every record whose server revision > request.cursor, including ones just accepted... }
}
```

Rules:
- Every record has a client-generated string `id`, `updatedAt` (ms, set by the client when it changed the record) and `deleted` (boolean tombstone). Deletes are never hard deletes during sync.
- **Last write wins per record by `updatedAt`.** An incoming record older than or equal to the stored one is ignored.
- The server keeps a per-user monotonically increasing `rev`. Each accepted write sets the record's `rev` to the next value. `cursor` = highest `rev` returned.
- Deterministic ids so two devices converge: `HabitLog.id = "<habitId>:<date>"`, `MoodLog.id = "<date>"`, `BadgeState.id = "<badgeId>"`, `Profile` has no id (one per user).
- Max 2 000 records per push. Unknown fields are dropped; invalid records → `400 INVALID_RECORD` naming the collection and id.
- A user can never read or write another user's rows.

### Record shapes (SPEC §6)
```ts
Habit        { id, name, icon, hue, category, frequency: { type: 'daily'|'days'|'weekly'|'monthly'|'custom', days?: boolean[7], times?: number, every?: number },
               goal, unit, step, timeOfDay, reminder: { on: boolean, time: string } | null, notes: string | null, createdAt, order, updatedAt, deleted }
HabitLog     { id, habitId, date, count, completedAt: number | null, updatedAt, deleted }
Task         { id, title, due: string | null, time: string | null, priority: 'high'|'med'|'low', done, doneAt: number | null, habitId: string | null,
               focusSessions: number, list: 'today'|'upcoming', createdAt, updatedAt, deleted }
FocusSession { id, start, end, mode: 'focus'|'short'|'long', minutes, taskId: string | null, completed, updatedAt, deleted }
MoodLog      { id, date, mood: 'great'|'good'|'okay'|'low'|'tired', tags: string[], note: string | null, loggedAt, updatedAt, deleted }
BadgeState   { id, unlockedAt: number | null, progress: number, updatedAt, deleted }
Profile      { name, xp, themeId, mode: 'light'|'dark'|'system', prefs: object, notificationPrefs: object,
               streakProtection: { enabled: boolean, restDaysLeft: number, restDays: string[] }, onboardedAt: number | null, updatedAt }
```
`prefs` and `notificationPrefs` are opaque JSON objects owned by the client.

## Export
`GET /v1/export?format=json` → the full dataset (all collections, excluding tombstones) as a JSON attachment.
`GET /v1/export?format=csv` → a `text/csv` attachment. One CSV with a `type` column (habit / log / task / focus / mood) and a flat set of columns.

---

# v1.1 — Plus, billing and admin

## Plus (entitlements)

An **entitlement** grants Plus for a period. A user is Plus when at least one entitlement
has `status` in (`active`, `grace`, `canceled`) and (`expiresAt` is null or in the future).
(`canceled` = auto-renew turned off: Plus continues until the paid period ends. `revoked` and
`refunded` are final and never re-activated by later Google data.)

```ts
Entitlement {
  id: string;
  userId: string;
  source: 'play_subscription' | 'play_lifetime' | 'admin' | 'trial';
  productId: string | null;        // 'plus' (subscription) | 'plus_lifetime' | null
  basePlanId: string | null;       // 'monthly' | 'yearly' | null
  status: 'active' | 'grace' | 'on_hold' | 'paused' | 'canceled' | 'expired' | 'revoked' | 'refunded';
  startsAt: number;                // ms
  expiresAt: number | null;        // ms; null = lifetime
  autoRenew: boolean;
  note: string | null;             // admin note ("beta tester")
  grantedBy: string | null;        // admin user id for source 'admin'
  createdAt: number; updatedAt: number;
}

PlusStatus {
  active: boolean;
  source: Entitlement['source'] | null;   // of the entitlement that grants it (latest expiry wins; lifetime beats all)
  expiresAt: number | null;
  autoRenew: boolean;
  productId: string | null;
  basePlanId: string | null;
}
```

- `GET /v1/me` → `{ user, profile, plus: PlusStatus }`; `user` gains `role: 'user' | 'admin'`.
- `GET /v1/plus` → `PlusStatus`.

## Google Play Billing

Product IDs (Play Console): subscription **`plus`** with base plans **`monthly`** and **`yearly`**
(yearly has a 7-day free-trial offer); one-time product **`plus_lifetime`**.

`POST /v1/billing/google/verify`
```jsonc
{ "productId": "plus" | "plus_lifetime", "purchaseToken": "…", "type": "subscription" | "inapp" }
```
→ `200 PlusStatus`. The server verifies the token with the Google Play Developer API
(`purchases.subscriptionsv2.get` / `purchases.products.get`), acknowledges it if needed,
and upserts the entitlement (keyed by `purchaseToken`).
Errors: `400 INVALID_PURCHASE` (Google says invalid / not purchased / pending), `409 PURCHASE_OWNED_ELSEWHERE`
(token already linked to another account), `503 BILLING_NOT_CONFIGURED` (no Google credentials),
`502 BILLING_UPSTREAM_ERROR` (Google failed; safe to retry — the entitlement may already be saved).

**Dev fake mode:** when the server env `BILLING_FAKE=true`, tokens starting with `fake:` are
accepted without calling Google — format `fake:<monthly|yearly|lifetime>:<random>` (each token is a
separate purchase; monthly/yearly get 30/365-day expiries, yearly adds no trial), so the whole
flow can be tested before a Play account exists. Never enable in production.

`POST /v1/billing/google/rtdn?token=<RTDN_SECRET>` — Google Cloud Pub/Sub **push** endpoint for
Real-time developer notifications. Body `{ message: { data: base64(json) } }`. The server re-fetches
the subscription from Google and updates the entitlement (renewed, canceled, on hold, grace,
expired, revoked, refunded via `voidedPurchaseNotification`). Always `204` once processed (or ignorable).

## Admin API (`/v1/admin/*`, requires `role: 'admin'`, else `403 FORBIDDEN`)

Admins sign in with the normal `/v1/auth/login`. Disabled users get `403 ACCOUNT_DISABLED` on
login, refresh and every authenticated route.

| Route | Result |
|---|---|
| `GET /v1/admin/stats` | `{ users: { total, new7d, new30d, active7d, disabled }, plus: { active, bySource: {…}, byPlan: { monthly, yearly, lifetime, admin, trial } }, revenue: { monthlyEstimateInr }, signupsByDay: {date,count}[30], activeByDay: {date,count}[30] }` |
| `GET /v1/admin/users?query=&plan=all\|plus\|free&status=all\|active\|disabled&page=1&pageSize=25` | `{ items: AdminUserRow[], total, page, pageSize }` |
| `GET /v1/admin/users/:id` | `{ user: AdminUserRow, profile: { xp, level, themeId } \| null, counts: { habits, habitLogs, tasks, focusSessions, moodLogs }, entitlements: Entitlement[] }` |
| `POST /v1/admin/users/:id/grant` `{ months?: 1..24, days?: 1..366, lifetime?: boolean, note?: string }` | `201 Entitlement` (source `admin`; starts at the current Plus expiry if still active, else now) |
| `POST /v1/admin/entitlements/:id/revoke` `{ note?: string }` | `200 Entitlement` (status `revoked`) |
| `POST /v1/admin/users/:id/disable` / `…/enable` | `200 AdminUserRow` (disable also revokes refresh tokens) |
| `DELETE /v1/admin/users/:id` | `204` (all data) |
| `GET /v1/admin/subscriptions?status=all\|active\|canceled\|expired\|revoked\|refunded&source=all\|play\|admin\|trial&page&pageSize` | `{ items: (Entitlement & { userEmail })[], total, page, pageSize }` |
| `GET /v1/admin/audit?page&pageSize` | `{ items: { id, adminEmail, action, targetUserId, targetEmail, details, createdAt }[], total, page, pageSize }` |

```ts
AdminUserRow { id, email, name, role, createdAt, lastSyncAt: number | null, disabledAt: number | null, habitCount, plus: PlusStatus }
```
Every admin write is recorded in the audit log. The first admin is created with the server CLI:
`npm run admin:create -- you@company.com` (promotes an existing account, or creates one and prints a
temporary password).

Revenue estimate uses env prices `PRICE_MONTHLY_INR` (99), `PRICE_YEARLY_INR` (699),
`PRICE_LIFETIME_INR` (1999): monthly + yearly/12 for active Play subscriptions.
