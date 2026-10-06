import { RefreshCw, RotateCw, X } from "lucide-react";
import { resetLocalData } from "@/db/dexie";
import { useAuth } from "@/hooks/use-auth";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { syncEngine } from "@/sync/engine";

export function SyncSettings({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const status = useSyncStatus();
  const { session } = useAuth();

  if (!open) return null;

  const lastSync = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString()
    : "never";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="font-semibold">Offline &amp; sync</h3>
            <p className="text-xs text-slate-500">
              Changes are stored on this device first, then synced to Supabase.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <StatusRow
              label="Backend"
              value={status.configured ? "Supabase" : "Local only"}
            />
            <StatusRow label="Signed in" value={session?.name ?? "—"} />
            <StatusRow
              label="Network"
              value={status.online ? "Online" : "Offline"}
            />
            <StatusRow label="Queued changes" value={String(status.pending)} />
            <StatusRow label="Failed" value={String(status.failed)} />
            <StatusRow label="Last sync" value={lastSync} />
            {status.nextRetryAt && (
              <StatusRow
                label="Next retry"
                value={new Date(status.nextRetryAt).toLocaleTimeString()}
              />
            )}
          </div>

          {status.lastError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {status.lastError}
            </p>
          )}

          <p className="text-xs text-slate-500">
            Configure the backend with <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>. Without them the app runs
            local-only.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                "Clear local data and re-sync from Supabase? Any unsynced local changes will be lost.",
              );
              if (ok) void resetLocalData();
            }}
            className="text-xs font-medium text-rose-600 hover:underline"
          >
            Reset local cache
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void syncEngine.syncNow()}
              disabled={!status.configured}
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw className="size-4" /> Sync now
            </button>
            {status.failed > 0 && (
              <button
                type="button"
                onClick={() => void syncEngine.retryFailed()}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
              >
                <RotateCw className="size-4" /> Retry failed
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
