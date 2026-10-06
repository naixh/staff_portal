# Saloon — Barber Salon Daily Sales Manager

An offline-first Progressive Web App (PWA) for managing daily sales at a barber
salon. Works on mobile and the web, stores everything locally in an in-browser
NoSQL database, and automatically synchronizes with Supabase whenever a network
connection is available.

## Features

- **Daily sales entry** — record services sold, barber, price, payment method.
- **Dashboard** — today's totals, breakdown by payment method and barber.
- **Services catalog** — manage the list of services and their prices in
  **MVR and USD** (admin only). A sale is billed in the currency picked on the
  New Sale screen.
- **Attendance** — clock in/out and breaks, saved against the signed-in account.
- **Roles & departments** — salon staff see the sales tools; *other* staff
  (cleaners, guards, office help…) get a simple home screen with attendance and
  their salary only.
- **Payroll** — admins configure salary, food allowance and bonus per person,
  run a monthly payment and sign it off on a canvas; the staff member signs back
  to acknowledge receipt.
- **Work permits** — upload an employment permit image per staff member; staff
  can view theirs from their home screen.
- **Offline-first** — all read/write operations go to a local IndexedDB
  database (Dexie). The app is fully usable with no network.
- **Auto-sync** — a background sync engine pushes pending local changes to a
  remote server and pulls down server changes whenever the device is online.
- **Installable PWA** — add to home screen on mobile / install on desktop.
- **Responsive** — mobile-first UI built with HeroUI + Tailwind CSS.

## Tech Stack

| Concern              | Library                                    |
| -------------------- | ------------------------------------------ |
| Framework            | React + TypeScript                         |
| Build tool           | Vite                                       |
| PWA / Offline        | vite-plugin-pwa                            |
| UI components         | HeroUI (@heroui/react)                     |
| Styling              | Tailwind CSS                               |
| Data fetching        | TanStack Query (@tanstack/react-query)     |
| Local database (NoSQL)| Dexie (IndexedDB wrapper)                  |
| Sync backend         | Supabase (Postgres + Auth)                 |
| Routing              | TanStack Router (@tanstack/react-router)   |

## Getting Started

```bash
npm install
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  UI Layer (HeroUI components, TanStack Router)   │
├─────────────────────────────────────────────────┤
│  Data Layer (TanStack Query hooks)              │
├─────────────────────────────────────────────────┤
│  Local API (CRUD over Dexie / IndexedDB)         │
├─────────────────────────────────────────────────┤
│  Sync Engine (push pending / pull remote)       │
├─────────────────────────────────────────────────┤
│  Remote Server (Supabase — Postgres + Auth)     │
└─────────────────────────────────────────────────┘
```

### Offline-first data flow

1. Every create/update/delete hits the **local Dexie database** synchronously.
2. A copy of the mutation is appended to a `sync_queue` table.
3. TanStack Query caches results; queries read from Dexie so they work offline.
4. The **sync engine** runs:
   - on app start,
   - when the browser fires the `online` event,
   - on a periodic interval (every 60s),
   - after every local mutation (debounced).
5. When online, the engine drains `sync_queue` to the server and pulls remote
   changes, reconciling by `updatedAt` timestamps.

### Conflict resolution

Records carry an `updatedAt` field. On pull, the record with the later
`updatedAt` wins. Last-write-wins is intentionally simple; extend
`sync/engine.ts` with a richer strategy if needed.

### Offline queue & retry

Every local write is persisted in Dexie and appended to the `syncQueue` outbox,
so nothing is lost while the network or the server is unavailable.

- Failed pushes are retried with **exponential backoff** (5s → 5min, jittered)
  and queued changes are never dropped.
- The engine re-syncs automatically on the `online` event, when the tab
  regains focus, after each local write (debounced), and on a periodic safety
  poll.
- Transport / `5xx` errors back the whole queue off; `4xx` errors skip only the
  offending entry.
- The backend is configured with `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. Without them the app runs local-only (and falls back
  to device-local PIN auth).

The topbar sync pill and the banner below the header show online/offline state
and pending/failed counts, and offer a manual **Sync now** / **Retry**.

## Backend (Supabase) & deploy (Vercel)

Data and authentication run on **Supabase** (Postgres + Auth). Rows live in a
single `records` table (JSONB documents keyed by `user_id, table_name, id`)
guarded by Row Level Security, so each user only sees their own data. The
client signs in with a mobile number + 6-digit PIN; new accounts start
**pending** and must be approved by an admin before they can use the app.

### 1. Create the schema

Apply the migrations in `supabase/migrations/`. Either paste them into the
Supabase **SQL Editor**, or use the CLI:

```bash
npx supabase link --project-ref uxelhcexemzmrebzadis
npx supabase db push
```

`0001_init.sql` creates the `records` + `profiles` tables, the `updated_at`
and new-user triggers, `is_admin()`, and all RLS policies.

`0007_payroll.sql` adds the staff **department** (`salon` / `other`), the
per-person payroll defaults (salary, food, bonus), the work-permit image, and the
`payroll_payments` table with its `sign_payroll` RPC.

`0008_departments.sql` makes departments configurable: the fixed `salon` /
`other` pair becomes an editable list in `settings` (each with a "salon tools"
flag), and `profiles.department` accepts any configured id.

### 2. Enable auth (no SMS)

Sign-in is "mobile + PIN" (an email also works for admin accounts), mapped
internally to Supabase **email + password**. Mobile numbers become
`<mobile>@<domain>` (domain defaults to `salonos.app`), so there's **no Phone
provider and no SMS**.

Dashboard → **Authentication → Providers → Email** → keep the provider enabled.
You can **leave "Confirm email" on**: `0006_approve.sql` adds an `approve_user`
RPC (SECURITY DEFINER, owner/admin only) that confirms the address when you
approve someone in the app, so staff can sign in right away. (Disabling
confirmation also works if you prefer.)

PINs are 6 digits — Supabase's default minimum password length.

### 3. Seed the first admin

See `supabase/migrations/0002_seed_admin.sql`:

1. **Authentication → Users → Add user**:
   - Email: `vinsaloon@gmail.com`
   - Password: `482913`
   - tick **Auto Confirm User**
2. Run `supabase/migrations/0002_seed_admin.sql` to promote it to an approved
   admin.

Then sign in with **email `vinsaloon@gmail.com`, PIN `482913`** (change it
afterwards in Authentication → Users).

Roles are **owner**, **admin** and **staff**, and each staff member also has a
**department**:

- **owner** — the account seeded above; can approve people and manage the team.
- **admin** — same privileges as the owner (approve, set roles).
- **staff** — regular employees; they use the app but can't manage the team.
  - **Salon** staff see sales, services and new sales.
  - **Other** staff see only attendance and their salary.

Departments are **configurable** on the Team page (add, rename, remove, and tick
"Salon tools" per department). Staff whose department has salon tools get the
sales screens; everyone else gets the simple staff portal.

Owners and admins see the **Team** page (in-app) to approve accounts, switch
someone between staff and admin, set their department, configure salary / food /
bonus and upload a work permit. Barbers sign in with their mobile number.
Approved staff are also added to the **Staff** roster so sales can be assigned
to them.

### 4. Configure the client

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
VITE_AUTH_PHONE_PREFIX=+960   # optional country code
```

The publishable/anon key is safe in the browser — RLS protects the data.

### 5. Deploy to Vercel

`vercel.json` is included (Vite framework, `dist` output directory). Import the
repo on Vercel, add the same `VITE_*` variables under Project → Settings →
Environment Variables, and deploy.

> **Legacy:** the `worker/` directory (Cloudflare Workers KV sync API) predates
> Supabase and is no longer used by the app — it can be deleted.

## Project Structure

```
saloon/
├── public/
│   └── pwa-*.png              # app icons
├── src/
│   ├── db/dexie.ts            # Dexie schema + instance
│   ├── api/local.ts           # local CRUD over Dexie
│   ├── sync/
│   │   ├── engine.ts          # push/pull sync
│   │   └── online.ts          # online/offline detection
│   ├── hooks/                 # TanStack Query hooks
│   ├── routes/                # page components
│   ├── components/            # shared UI
│   ├── models/types.ts        # domain types
│   ├── supabase.ts            # Supabase browser client
│   ├── providers/app-providers.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/migrations/       # Postgres schema + RLS + admin seed
├── vercel.json                # Vercel deploy config
├── worker/                    # legacy Workers KV sync API (unused)
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

## Roadmap / Plan

- [x] Project scaffold + tooling
- [x] Dexie schema and local CRUD API
- [x] Sync engine scaffold (push/pull + online detection)
- [x] Dashboard + sales entry + services catalog UI
- [x] PWA manifest + service worker
- [x] Supabase backend (Postgres + RLS) + sync engine
- [x] Authentication (mobile + PIN via Supabase Auth)
- [ ] Reports & weekly summaries
- [ ] Image-based service catalog