# Tend — Build better days

Habit tracker + Pomodoro focus + tasks, with mood, insights and gentle gamification.
Android-first Expo app, responsive from phones to tablets/desktop, backed by a small
Node API so your data syncs and is never lost.

```
app/      Expo SDK 57 · React Native · TypeScript · Expo Router · Reanimated · Zustand
server/   Node 20 · Fastify 5 · Prisma 7 (SQLite in dev, Postgres-ready)
docs/     SPEC.md (design spec), API.md (app ↔ server contract), design handoff
```

## Run it locally (Android emulator)

Prerequisites: Node 20+, Android Studio (SDK + an emulator), Java 17.

```sh
# 1. API server
cd server
cp .env.example .env          # set JWT_SECRET to a long random string
npm install
npm run db:deploy
npm run dev                   # http://localhost:4000

# 2. App (in another terminal)
cd app
npm install
npx expo run:android          # first time: builds + installs the dev client
# later runs: npx expo start --dev-client

# 3. Let the emulator reach both ports on your Mac
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8081 tcp:8081
```

**Physical phone on Wi-Fi:** create `app/.env` with
`EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000` and restart the bundler.

**Demo data:** in a development build, *You → Load demo data (dev)* fills the account
with ~200 days of history matching the design (Level 12, 12-day streak…). Long-press the
Focus ring in a dev build to make a running session finish in 8 seconds.

## Release APK

```sh
cd app
npx expo prebuild --platform android
cd android && EXPO_PUBLIC_API_URL=https://your-api.example.com ./gradlew assembleRelease
# → app/android/app/build/outputs/apk/release/app-release.apk
```

The generated project signs release builds with the debug keystore. For the Play Store,
create an upload key and configure signing (or use `npx eas-cli build -p android`).
`EXPO_PUBLIC_API_URL` is inlined into the JS bundle during that Gradle step; without it
the app talks to `http://localhost:4000` (fine for an emulator with `adb reverse`).

## Deploying the server

Any Node 20 host works (Render, Railway, Fly.io, a VPS). For production switch Prisma to
Postgres — steps in [`server/README.md`](server/README.md). Set `JWT_SECRET`,
`DATABASE_URL`, `CORS_ORIGIN`, run `npm run build && npm run db:deploy && npm start`.

## Checks

```sh
cd app    && npx tsc --noEmit && npx expo lint
cd server && npm run typecheck && npm test
```

## Useful scripts (app)

| Script | What it does |
|---|---|
| `npm run gen:themes` | Regenerate the 8 themes × light/dark from the OKLCH formulas (+ contrast check) |
| `npm run gen:sounds` | Re-synthesise all UI sounds and ambient loops |
| `npm run gen:icons` | Regenerate app / adaptive / notification / splash icons |
| `npm run check:demo` | Print the numbers the demo data produces |
