/**
 * SalonOS sync API — a Cloudflare Worker that stores the salon dataset in
 * Workers KV (a key-value / NoSQL store).
 *
 * It implements exactly the contract expected by the PWA's sync engine
 * (`saloon/src/sync/engine.ts`):
 *
 *   GET    /{table}?since={cursor}   -> { table, records, cursor }
 *   POST   /{table}/{id}             -> upsert a record (create)
 *   PUT    /{table}/{id}             -> upsert a record (update)
 *   DELETE /{table}/{id}             -> upsert a soft-delete tombstone
 *   GET    /health                   -> { ok: true }
 *
 * Storage layout (a single KV namespace):
 *   key      = `${table}:${id}`
 *   value    = the record JSON exactly as the client sent it
 *   metadata = { updatedAt: <server ms>, deleted: <bool> }
 *
 * The record's own `updatedAt` (client clock) is preserved so the client can do
 * last-write-wins. The KV metadata `updatedAt` (server clock) drives the pull
 * cursor, so incremental pulls do not depend on client clock skew.
 *
 * Consistency: Workers KV is eventually consistent, so a key written moments
 * ago may not appear in `list()` for up to ~60s. To avoid ever missing an
 * update, the returned cursor trails the observed high-water mark by
 * `SAFETY_WINDOW_MS`; records inside that window are re-sent and the client
 * deduplicates them by `updatedAt`.
 *
 * The `KVNamespace` type below is declared locally (mirroring the parts of
 * `@cloudflare/workers-types` this worker uses) so it type-checks with nothing
 * installed. Run `npm i -D @cloudflare/workers-types` and add it to
 * `tsconfig.json#compilerOptions.types` for the full official types.
 */

const TABLES = ["services", "barbers", "sales"] as const;
type Table = (typeof TABLES)[number];

/** How far the pull cursor trails the observed high-water mark (ms). */
const SAFETY_WINDOW_MS = 2 * 60 * 1000;

// ── Minimal KV binding types (subset of @cloudflare/workers-types) ─────────

interface KVListKey {
  name: string;
  metadata: { updatedAt?: number; deleted?: boolean } | null;
}

interface KVListResult {
  keys: KVListKey[];
  list_complete: boolean;
  cursor?: string;
}

interface KVNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  put(
    key: string,
    value: string,
    options?: { metadata?: Record<string, unknown> },
  ): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<KVListResult>;
}

interface Env {
  /** KV namespace binding — see wrangler.toml. */
  SALON_DB: KVNamespace;
  /** When set, every request must send `Authorization: Bearer <SYNC_TOKEN>`. */
  SYNC_TOKEN?: string;
  /** CORS origin for the PWA. Defaults to `*`. */
  ALLOWED_ORIGIN?: string;
}

type StoredRecord = Record<string, unknown> & {
  id?: string;
  updatedAt?: number;
  deleted?: boolean;
};

// ── HTTP helpers ───────────────────────────────────────────────────────────

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function isTable(value: string): value is Table {
  return (TABLES as readonly string[]).includes(value);
}

function keyFor(table: Table, id: string): string {
  return `${table}:${id}`;
}

async function readJson(request: Request): Promise<StoredRecord> {
  try {
    const text = await request.text();
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as StoredRecord) : {};
  } catch {
    return {};
  }
}

// ── Storage operations ─────────────────────────────────────────────────────

async function upsert(
  env: Env,
  table: Table,
  id: string,
  incoming: StoredRecord,
  forceDelete: boolean,
): Promise<StoredRecord> {
  const key = keyFor(table, id);
  const existing = (await env.SALON_DB.get(key, "json")) as StoredRecord | null;

  const merged: StoredRecord = { ...(existing ?? {}), ...incoming, id };
  if (forceDelete) merged.deleted = true;
  if (typeof merged.updatedAt !== "number") merged.updatedAt = Date.now();
  if (typeof merged.deleted !== "boolean") merged.deleted = false;

  await env.SALON_DB.put(key, JSON.stringify(merged), {
    metadata: { updatedAt: Date.now(), deleted: merged.deleted },
  });
  return merged;
}

async function listSince(
  env: Env,
  table: Table,
  since: number | null,
): Promise<{ records: StoredRecord[]; cursor: number }> {
  const prefix = `${table}:`;
  const changed: string[] = [];
  let highWater = 0;
  let listCursor: string | undefined;

  do {
    const page = await env.SALON_DB.list({ prefix, cursor: listCursor });
    for (const entry of page.keys) {
      const serverUpdated = entry.metadata?.updatedAt ?? 0;
      if (serverUpdated > highWater) highWater = serverUpdated;
      if (since === null || serverUpdated > since) changed.push(entry.name);
    }
    listCursor = page.list_complete ? undefined : page.cursor;
  } while (listCursor);

  const records: StoredRecord[] = [];
  for (const name of changed) {
    const record = (await env.SALON_DB.get(name, "json")) as StoredRecord | null;
    if (record) records.push(record);
  }

  const cursor = Math.max(since ?? 0, highWater - SAFETY_WINDOW_MS);
  return { records, cursor };
}

// ── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (env.SYNC_TOKEN) {
      const auth = request.headers.get("Authorization") ?? "";
      if (auth !== `Bearer ${env.SYNC_TOKEN}`) {
        return json({ error: "unauthorized" }, 401, env);
      }
    }

    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length === 1 && segments[0] === "health") {
      return json({ ok: true }, 200, env);
    }

    const [table, id] = segments;
    if (!table || !isTable(table)) {
      return json({ error: "unknown table" }, 404, env);
    }

    // GET /{table}?since={cursor} — incremental list.
    if (segments.length === 1) {
      if (request.method !== "GET") {
        return json({ error: "method not allowed" }, 405, env);
      }
      const sinceParam = url.searchParams.get("since");
      const since = sinceParam ? Number(sinceParam) : null;
      const { records, cursor } = await listSince(
        env,
        table,
        since !== null && Number.isFinite(since) ? since : null,
      );
      return json({ table, records, cursor }, 200, env);
    }

    // /{table}/{id} — single record reads and writes.
    if (segments.length === 2 && id) {
      if (request.method === "GET") {
        const record = await env.SALON_DB.get(keyFor(table, id), "json");
        return record
          ? json({ table, record }, 200, env)
          : json({ error: "not found" }, 404, env);
      }
      if (
        request.method !== "POST" &&
        request.method !== "PUT" &&
        request.method !== "DELETE"
      ) {
        return json({ error: "method not allowed" }, 405, env);
      }
      const body = await readJson(request);
      const record = await upsert(
        env,
        table,
        id,
        body,
        request.method === "DELETE",
      );
      return json({ ok: true, record }, 200, env);
    }

    return json({ error: "not found" }, 404, env);
  },
};
