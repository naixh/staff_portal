/**
 * Offline-first sync engine (Supabase transport).
 *
 * Local writes always land in Dexie and are appended to the `syncQueue` outbox,
 * so the app keeps working with no network. When Supabase is reachable, the
 * engine drains the outbox into the `records` table and pulls rows written by
 * other devices since the stored cursor.
 *
 * Rows are keyed by (user_id, table_name, id) and scoped by Row Level Security.
 * `updated_at` is set server-side and used as the incremental cursor. The
 * record's own `updatedAt` field is still used for last-write-wins on the client.
 */
import { db } from "@/db/dexie";
import {
  applyRemoteRecord,
  dequeue,
  markQueueFailure,
  resetQueueAttempts,
} from "@/api/local";
import { getSupabase, isSupabaseConfigured } from "@/supabase";
import type { SyncTable } from "@/models/types";

const LAST_SYNC_KEY = "sync:lastSyncedAt";
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const SAFETY_POLL_MS = 60_000;
const WRITE_DEBOUNCE_MS = 800;
const PAGE_SIZE = 500;
const PULL_TABLES: SyncTable[] = ["services", "barbers", "sales", "attendance"];

export type SyncPhase = "idle" | "offline" | "syncing" | "error";

export interface SyncStatus {
  phase: SyncPhase;
  /** Whether the browser reports a network connection. */
  online: boolean;
  /** Whether a Supabase backend is configured. */
  configured: boolean;
  /** Number of queued (not yet pushed) local changes. */
  pending: number;
  /** Number of queued changes whose most recent push attempt failed. */
  failed: number;
  lastSyncedAt: number | null;
  /** Epoch ms when the next retry is due, if any. */
  nextRetryAt: number | null;
  lastError?: string;
}

export type SyncListener = (status: SyncStatus) => void;

/** Exponential backoff with full jitter, capped at MAX_BACKOFF_MS. */
function backoffDelay(attempts: number): number {
  const ceiling = Math.min(
    BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1),
    MAX_BACKOFF_MS,
  );
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
}

class SyncEngine {
  private status: SyncStatus = {
    phase: "idle",
    online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
    configured: isSupabaseConfigured,
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
    nextRetryAt: null,
  };
  private listeners = new Set<SyncListener>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private userId: string | null = null;

  // ─── Public API ───────────────────────────────────────────────────

  subscribe = (listener: SyncListener): (() => void) => {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getStatus = (): SyncStatus => this.status;

  /** Set the signed-in Supabase user id (null when signed out). */
  setUserId = (id: string | null): void => {
    this.userId = id;
    if (id) void this.syncNow();
  };

  /** Clear backoff state and immediately retry every queued change. */
  retryFailed = async (): Promise<void> => {
    await resetQueueAttempts();
    void this.syncNow();
  };

  start = (): void => {
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibility);
    void this.hydrate();
    void this.syncNow();
  };

  stop = (): void => {
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  };

  /** Debounce a sync pass after a burst of local writes. */
  schedule = (): void => {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(
      () => void this.syncNow(),
      WRITE_DEBOUNCE_MS,
    );
  };

  syncNow = async (): Promise<void> => {
    if (this.running) return;

    const online = this.isOnline();
    const pending = await db.syncQueue.count();

    if (!isSupabaseConfigured) {
      this.update({
        phase: "idle",
        online,
        configured: false,
        pending,
        failed: 0,
        nextRetryAt: null,
      });
      return;
    }
    if (!online) {
      this.update({ phase: "offline", online, configured: true, pending });
      return;
    }
    if (!this.userId) {
      // Signed out — nothing to sync yet.
      this.update({ phase: "idle", online, configured: true, pending });
      return;
    }

    this.running = true;
    this.update({ phase: "syncing", online, configured: true, pending });
    try {
      await this.push();
      await this.pull();

      const at = Date.now();
      await db.meta.put({ key: LAST_SYNC_KEY, value: at });

      const left = await db.syncQueue.count();
      const failed = await this.failedCount();
      const nextRetryAt = await this.earliestRetryAt();
      this.update({
        phase: failed > 0 ? "error" : "idle",
        pending: left,
        failed,
        lastSyncedAt: at,
        nextRetryAt,
        lastError: failed > 0 ? this.status.lastError : undefined,
      });
      this.scheduleNext(nextRetryAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = await this.failedCount();
      const nextRetryAt = await this.earliestRetryAt();
      this.update({ phase: "error", lastError: message, failed, nextRetryAt });
      this.scheduleNext(nextRetryAt);
    } finally {
      this.running = false;
    }
  };

  // ─── Push ─────────────────────────────────────────────────────────

  private async push(): Promise<void> {
    const userId = this.userId;
    if (!userId) return;

    const entries = await db.syncQueue.orderBy("createdAt").toArray();
    if (entries.length === 0) return;

    const now = Date.now();
    const supabase = getSupabase();

    for (const entry of entries) {
      // Skip entries still within their backoff window.
      if (entry.nextAttemptAt && entry.nextAttemptAt > now) continue;
      try {
        const payload = (entry.payload ?? {}) as Record<string, unknown>;
        const { error } = await supabase.from("records").upsert(
          {
            user_id: userId,
            table_name: entry.table,
            id: entry.recordId,
            data: payload,
            deleted: Boolean(payload.deleted),
          },
          { onConflict: "user_id,table_name,id" },
        );
        if (error) throw Object.assign(new Error(error.message), { code: error.code });
        await dequeue([entry.id]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markQueueFailure(
          entry.id,
          message,
          Date.now() + backoffDelay(entry.attempts + 1),
        );
        this.update({ phase: "error", lastError: message });
        const code = (err as { code?: string } | null)?.code;
        if (typeof code === "string") {
          // PostgREST error (RLS, constraint, bad payload) — skip this entry
          // and keep going; it stays queued and retries after its backoff.
          continue;
        }
        // Transport / network problem — stop the pass and back off.
        return;
      }
    }
  }

  // ─── Pull ─────────────────────────────────────────────────────────

  private async pull(): Promise<void> {
    const supabase = getSupabase();

    for (const table of PULL_TABLES) {
      let cursor = await this.getCursor(table);
      for (;;) {
        const base = supabase
          .from("records")
          .select("id,data,deleted,updated_at")
          .eq("table_name", table)
          .order("updated_at", { ascending: true })
          .limit(PAGE_SIZE);

        const { data, error } = cursor
          ? await base.gt("updated_at", cursor)
          : await base;
        if (error) throw new Error(error.message);

        const rows = data ?? [];
        if (rows.length === 0) break;

        for (const row of rows) {
          const record = {
            ...(row.data as Record<string, unknown>),
            id: row.id,
            deleted: row.deleted,
          };
          await applyRemoteRecord(table, record as never);
        }

        cursor = rows[rows.length - 1].updated_at as string;
        await this.setCursor(table, cursor);
        if (rows.length < PAGE_SIZE) break;
      }
    }
  }

  private async getCursor(table: string): Promise<string | null> {
    const rec = await db.meta.get(`cursor:${table}`);
    const value = rec?.value;
    return typeof value === "string" ? value : null;
  }

  private async setCursor(table: string, value: string): Promise<void> {
    await db.meta.put({ key: `cursor:${table}`, value });
  }

  // ─── Scheduling & status plumbing ─────────────────────────────────

  private handleOnline = (): void => {
    this.update({ online: true });
    void this.syncNow();
  };

  private handleOffline = (): void => {
    this.update({ online: false, phase: "offline" });
  };

  private handleVisibility = (): void => {
    if (document.visibilityState === "visible" && this.isOnline()) {
      void this.syncNow();
    }
  };

  private async hydrate(): Promise<void> {
    const rec = await db.meta.get(LAST_SYNC_KEY);
    this.update({
      online: this.isOnline(),
      configured: isSupabaseConfigured,
      lastSyncedAt: (rec?.value as number | undefined) ?? null,
      pending: await db.syncQueue.count(),
    });
  }

  private scheduleNext(nextRetryAt: number | null): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = nextRetryAt
      ? Math.max(1_000, nextRetryAt - Date.now())
      : SAFETY_POLL_MS;
    this.retryTimer = setTimeout(() => void this.syncNow(), delay);
  }

  private async failedCount(): Promise<number> {
    const entries = await db.syncQueue.toArray();
    return entries.filter((entry) => (entry.attempts ?? 0) > 0).length;
  }

  private async earliestRetryAt(): Promise<number | null> {
    const entries = await db.syncQueue.toArray();
    let earliest: number | null = null;
    for (const entry of entries) {
      if (entry.nextAttemptAt && (earliest === null || entry.nextAttemptAt < earliest)) {
        earliest = entry.nextAttemptAt;
      }
    }
    return earliest;
  }

  private isOnline(): boolean {
    return typeof navigator === "undefined" ? true : navigator.onLine !== false;
  }

  private update(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener(this.status);
  }
}

export const syncEngine = new SyncEngine();

/** Subscribe to sync status from React. */
export function subscribeSync(listener: SyncListener): () => void {
  return syncEngine.subscribe(listener);
}
