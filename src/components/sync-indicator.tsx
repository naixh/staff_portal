import type { ReactNode } from "react";
import {
  Check,
  CloudOff,
  LoaderCircle,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { syncEngine } from "@/sync/engine";
import { useSyncStatus } from "@/hooks/use-sync-status";

function lastSyncLabel(at: number | null): string {
  if (!at) return "never";
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Compact, clickable sync status pill. Clicking triggers an immediate sync
 * (or a full retry when there are failed changes).
 */
export function SyncIndicator() {
  const status = useSyncStatus();
  const { online, configured, phase, pending, failed } = status;

  let label = "Synced";
  let tone = "border-emerald-200 bg-emerald-50 text-emerald-700";
  let icon: ReactNode = <Check className="size-3.5" />;

  if (!configured) {
    label = "Local only";
    tone = "border-slate-200 bg-slate-50 text-slate-500";
    icon = <Server className="size-3.5" />;
  } else if (!online) {
    label = "Offline";
    tone = "border-rose-200 bg-rose-50 text-rose-700";
    icon = <CloudOff className="size-3.5" />;
  } else if (phase === "syncing") {
    label = "Syncing";
    tone = "border-blue-200 bg-blue-50 text-blue-700";
    icon = <LoaderCircle className="size-3.5 animate-spin" />;
  } else if (failed > 0) {
    label = `${failed} failed`;
    tone = "border-rose-200 bg-rose-50 text-rose-700";
    icon = <TriangleAlert className="size-3.5" />;
  } else if (pending > 0) {
    label = `${pending} pending`;
    tone = "border-amber-200 bg-amber-50 text-amber-700";
    icon = <RefreshCw className="size-3.5" />;
  }

  const details = [
    !configured
      ? "No sync server configured — changes are stored on this device."
      : online
        ? "Connected"
        : "Offline — changes queue locally",
    configured ? `Queued changes: ${pending}` : null,
    configured && failed > 0 ? `Failed: ${failed}` : null,
    `Last sync: ${lastSyncLabel(status.lastSyncedAt)}`,
    status.lastError ? `Last error: ${status.lastError}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      onClick={() =>
        void (failed > 0 ? syncEngine.retryFailed() : syncEngine.syncNow())
      }
      disabled={!configured}
      title={details}
      aria-label={`Sync status: ${label}. Click to sync now.`}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default ${tone}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
