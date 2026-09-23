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
