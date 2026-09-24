# Tend Admin

Admin console for Tend: users, Plus entitlements, subscriptions and the audit log.
Vite + React 19 + TypeScript, react-router, TanStack Query, hand-written CSS (Aurora tokens).
The product name lives in one place: `src/brand.ts` (`APP_NAME`).

## Run locally

```bash
cd admin
npm install
cp .env.example .env          # optional; defaults to http://localhost:4000
npm run dev                   # http://localhost:5173
```

The API (`server/`) must be running and must allow the admin origin in `CORS_ORIGIN`
(e.g. `http://localhost:5173`).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the built `dist/` on port 4173 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (TypeScript + react-hooks) |

## Environment

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | Base URL of the Tend API, no trailing slash. Baked in at build time. |

## Creating the first admin

Admins sign in with a normal account whose role is `admin`. Promote one with the server CLI:

```bash
cd server && npm run admin:create -- you@company.com
```

It promotes an existing account, or creates one and prints a temporary password.
Non-admin accounts are rejected at the login screen.

## Auth

- Access token (15 min) is kept in memory only; the refresh token is kept in `localStorage`.
- Any `401` triggers one refresh and a retry. Refreshes are single-flight (one shared promise
  per tab, plus a Web Lock across tabs) because refresh tokens rotate and are single-use.
- A rejected refresh or `ACCOUNT_DISABLED` signs the admin out. Sign out revokes the refresh token.

## Deploy

It's a static site: `npm run build` and host `dist/` anywhere (Vercel, Netlify, Cloudflare Pages,
S3 + CloudFront, nginx…).

1. Set `VITE_API_URL` to the production API (e.g. `https://api.example.com`) in the host's build env.
2. Add the admin origin (e.g. `https://admin.example.com`) to the server's `CORS_ORIGIN`.
3. Make unknown paths serve `index.html` (client-side routing). Included: `vercel.json` (Vercel) and
   `public/_redirects` (Netlify). For nginx: `try_files $uri /index.html;`.

Vercel/Netlify settings: root directory `admin`, build command `npm run build`, output `dist`.
