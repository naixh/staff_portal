# SalonOS Sync Worker

A Cloudflare Worker that stores the salon dataset in **Workers KV** (a
key-value / NoSQL store) and exposes the REST contract the PWA's sync engine
already speaks. The PWA keeps working offline against IndexedDB (Dexie) and
flushes queued changes here whenever the Worker is reachable.

## API

| Method | Path                     | Purpose                                  |
| ------ | ------------------------ | ---------------------------------------- |
| `GET`  | `/health`                | Liveness probe → `{ ok: true }`          |
| `GET`  | `/{table}?since={cursor}`| Incremental list → `{ table, records, cursor }` |
| `POST` | `/{table}/{id}`          | Upsert a record (create)                 |
| `PUT`  | `/{table}/{id}`          | Upsert a record (update)                 |
| `DELETE`| `/{table}/{id}`         | Upsert a soft-delete tombstone           |

`table` is one of `services`, `barbers`, `sales`. Records are stored exactly as
the client sends them (JSON), with server metadata used only for the cursor.

## Connect to Cloudflare

Wrangler needs credentials before it can create resources or deploy. Pick one:

- **Interactive (recommended):**

  ```bash
  npx wrangler login
  ```

  Opens a browser and stores an OAuth token under `~/.config/.wrangler`.

- **API token (CI / headless):** create a token with the *Workers KV Storage:
  Edit* and *Workers Scripts: Edit* permissions, then export it:

  ```bash
  export CLOUDFLARE_API_TOKEN="..."
  export CLOUDFLARE_ACCOUNT_ID="..."
  ```

Verify the connection:

```bash
npx wrangler whoami
```

> An expired OAuth token cannot be refreshed in a non-interactive environment —
> re-run `npx wrangler login` from an interactive terminal in that case.

## Deploy

```bash
cd worker
npm install

# 1. Create the KV namespace and copy the printed id
npx wrangler kv namespace create SALON_DB

# 2. Paste the id into wrangler.toml ([[kv_namespaces]] id)

# 3. Optional: set a shared secret (recommended) and allowed origin
npx wrangler secret put SYNC_TOKEN

# 4. Ship it
npm run deploy
```

Wrangler prints the deployed URL (e.g. `https://salonos-sync.<account>.workers.dev`).

Local development:

```bash
npm run dev        # start a local Worker with a local KV namespace
npm run typecheck  # tsc --noEmit
```

## Connect the PWA

Open the app → **gear icon** (topbar) → **Offline & sync**:

- **Sync server URL**: the Worker URL from above.
- **Token**: the same value as the `SYNC_TOKEN` secret (leave blank if unset).

You can also bake these in at build time with `VITE_SYNC_API_BASE` and
`VITE_SYNC_TOKEN`.

## Consistency notes

Workers KV is eventually consistent (writes are visible globally within ~60s).
The pull cursor therefore trails the observed high-water mark by a short safety
window, so a just-written record that hasn't propagated yet is simply re-sent on
the next pull. The client applies last-write-wins by `updatedAt`, so re-sending
is idempotent and no update is lost.

Deletes are soft (a `deleted: true` tombstone is stored) so other devices learn
about them on their next pull.

## Swapping the store

The handler only touches a tiny KV surface (`get` / `put` / `list`). To use a
different NoSQL backend (Durable Objects storage, R2, an external KV, …), keep
the HTTP contract above and reimplement `upsert` and `listSince` in
`src/index.ts`.
