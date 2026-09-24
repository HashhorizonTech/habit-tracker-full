# Launch guide — what's needed from you

Everything in the code is ready to switch on. This list is what only **you** can do
(accounts, money, legal, hosting). Work through it top to bottom; each step says what to
send back or where to paste it.

> The app is still called **Tend** as a placeholder — it's already used by other habit apps
> on Google Play, so pick a new name first (step 1). Renaming touches `app/src/lib/brand.ts`,
> `app/app.json`, `admin/src/brand.ts` and the legal pages — send me the name and I'll do it.

---

## 1. Pick the app name  *(before anything public)*
- Choose the name (shortlist: **Mossly**, **Budsy**, **Dinacharya**, or your own).
- Check it's free on Google Play (search the store) and in the **IP India trademark search**
  (https://tmrsearch.ipindia.gov.in/ — class 9, software). Consider filing a trademark.
- Decide the **package ID** (permanent once published), e.g. `in.hashhorizon.mossly`.
- ➜ **Send me:** name + package ID.

## 2. Host the server (API)
The server lives in `server/`. For production:
1. Pick a host that runs Node 20: **Render**, **Railway**, **Fly.io**, or a VPS.
2. Create a **Postgres** database (the host usually offers one). Follow "Switch to Postgres" in `server/README.md` (or ask me to do the switch — it's a small change + one migration).
3. Set environment variables (full list in `server/.env.example`):
   - `DATABASE_URL` — from your Postgres
   - `JWT_SECRET` — a long random string (e.g. `openssl rand -base64 48`)
   - `CORS_ORIGIN` — your admin panel URL, e.g. `https://admin.hashhorizon.in`
   - `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_RTDN_SECRET` — from step 5
   - `PRICE_MONTHLY_INR=99`, `PRICE_YEARLY_INR=699`, `PRICE_LIFETIME_INR=1999`
   - **Never** set `BILLING_FAKE=true` in production.
4. Build/start: `npm run build && npm run db:deploy && npm start`.
5. Point a domain at it with HTTPS, e.g. `https://api.hashhorizon.in` (hosts give free TLS).
- ➜ **Send me:** the API URL (I'll build the app against it).

## 3. Create the first admin + host the admin panel
1. On the server machine: `npm run admin:create -- you@hashhorizon.in`. If that email already has an app account it becomes an admin; otherwise the account is created and a temporary password is printed **once** — store it in a password manager. (There's no change-password screen yet; tell me if you want one.)
2. The admin panel (`admin/`) is a static site. Deploy to **Vercel/Netlify/Cloudflare Pages** or your own hosting:
   - Build command `npm run build`, output folder `dist`
   - Env `VITE_API_URL=https://api.hashhorizon.in`
3. Point `admin.hashhorizon.in` at it, and make sure that origin is in the server's `CORS_ORIGIN`.

## 4. Publish the legal pages on hashhorizon.in
Ready-made pages are in `docs/legal/` — upload them as:
| File | URL |
|---|---|
| `privacy.html` | `https://hashhorizon.in/app/<appname>/privacy` |
| `terms.html` | `https://hashhorizon.in/app/<appname>/terms` |
| `delete-account.html` | `https://hashhorizon.in/app/<appname>/delete-account` |

Before publishing, fill in / confirm:
- The support email (currently **support@hashhorizon.in** — make sure it exists and is monitored).
- In `terms.html`: the city for jurisdiction (`[your city]`).
- Have them reviewed by a lawyer if you can — they're a solid plain-language starting point, not legal advice.
- ➜ **Send me:** the final URLs if they differ (they're linked from the paywall and settings).

## 5. Google Play Console (when you buy the account)
1. **Create the developer account** — https://play.google.com/console (US$25 one-time; organization account for HashHorizon needs a D-U-N-S number; identity verification can take a few days).
2. **Payments profile** — Console → Setup → Payments profile (business name, address, bank, PAN/GST). Required to sell anything.
3. **Create the app** in the Console with your chosen name and default language.
4. **Upload a first build** to the *Internal testing* track (billing products can only be created once an app bundle with the billing permission is uploaded). ➜ I'll give you the `.aab` file.
5. **Create the products** — Console → Monetize → Products:
   - *Subscriptions* → create **`plus`** with two base plans:
     - `monthly` — auto-renewing, 1 month, ₹99
     - `yearly` — auto-renewing, 1 year, ₹699; add an **offer** on it: free trial, 7 days, eligibility "New customer acquisition", offer ID containing `trial` (e.g. `yearly-trial`)
   - *In-app products* → create **`plus_lifetime`**, ₹1,999
   - Use "Set prices" to auto-convert other countries, or restrict to India for launch.
6. **Service account for purchase verification**
   - Google Cloud Console → create a project (or use the one linked to Play) → IAM → Service accounts → create → **Create key (JSON)**.
   - Play Console → Users and permissions → Invite the service account email → grant **View financial data** and **Manage orders and subscriptions**.
   - Put the JSON into the server env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (paste the JSON or a file path). *(Permissions can take up to 24 h to start working.)*
7. **Real-time developer notifications** (renewals, cancellations, refunds)
   - Google Cloud → Pub/Sub → create topic `play-billing` → grant `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on it.
   - Create a **push subscription** on that topic with endpoint
     `https://api.hashhorizon.in/v1/billing/google/rtdn?token=<RTDN_SECRET>` (make up a long random secret; put the same value in server env `GOOGLE_RTDN_SECRET`).
   - Play Console → Monetize → Monetization setup → Real-time developer notifications → paste the topic name → **Send test notification**.
8. **License testers** — Console → Setup → License testing → add your Gmail(s). Testers can buy with test cards and are never charged; subscriptions renew every few minutes for testing.
9. **Store listing** — app name, short + full description, icon (512×512, I'll export), feature graphic (1024×500), at least 2 phone screenshots (I can capture them), category *Health & Fitness* or *Productivity*, contact email, privacy policy URL.
10. **App content forms** — Data safety (answers below), content rating questionnaire, target audience (13+), ads: *No ads*, account deletion URL (step 4), "Government app: no".

### Data safety answers (for the form)
| Question | Answer |
|---|---|
| Data collected | Name, Email address (Personal info) · App activity: other user-generated content (habits, tasks, focus sessions) · Health & fitness: mood check-ins (if you consider mood "health info", declare it) · Purchase history |
| Shared with third parties | No (service providers don't count as sharing) |
| Encrypted in transit | Yes |
| Users can request deletion | Yes (in app + web URL) |
| Purpose | App functionality, Account management |
| Ads / analytics SDKs | None |

## 6. Test purchases end-to-end
With the internal-testing build installed from Play on a real phone signed in as a license tester:
1. Open the app → You → **Try Plus** → buy Monthly / start the Yearly trial / buy Lifetime.
2. Check the admin panel → Users → your account shows Plus with the right plan.
3. Cancel in Play → within minutes the admin panel shows *Canceled* (Plus stays until expiry).
4. Grant yourself 1 month from the admin panel → the app shows Plus after reopening.

## 7. Release
Production track → roll out (start with a staged rollout, e.g. 20%). Google's review usually takes a few days for new apps.

---

### Quick checklist
- [ ] App name + package ID decided → sent
- [ ] Server hosted on HTTPS with Postgres → API URL sent
- [ ] First admin created, admin panel hosted
- [ ] Legal pages live on hashhorizon.in (support email + city filled)
- [ ] Play developer account + payments profile
- [ ] Internal test build uploaded, products `plus` (monthly, yearly+trial) and `plus_lifetime` created
- [ ] Service account JSON + RTDN Pub/Sub set up → env vars filled
- [ ] License testers added, purchases tested
- [ ] Store listing, Data safety, content rating, account-deletion URL done
- [ ] Production release
