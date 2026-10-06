import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { syncEngine } from "@/sync/engine";
import { useSyncStatus } from "@/hooks/use-sync-status";

/**
 * Full-width status strip shown under the topbar whenever the device is
 * offline or local changes are still waiting to reach the server.
 */
export function SyncBanner() {
  const status = useSyncStatus();
  const { online, configured, pending, failed, phase } = status;

  if (!configured) return null;
  if (online && pending === 0 && failed === 0) return null;

  const danger = !online || failed > 0;
  const tone = danger
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
  const Icon = !online ? CloudOff : failed > 0 ? TriangleAlert : RefreshCw;

  const changes = `${pending} ${pending === 1 ? "change" : "changes"}`;
  let message: string;
  if (!online) {
    message = `You're offline. ${changes} will sync automatically when you're back online.`;
  } else if (failed > 0) {
    message = `${failed} ${
      failed === 1 ? "change" : "changes"
    } couldn't sync. We'll keep retrying in the background.`;
  } else if (phase === "syncing") {
    message = `Syncing ${changes}…`;
  } else {
    message = `${changes} waiting to sync.`;
  }

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2 text-sm md:px-6 ${tone}`}
      role="status"
    >
      <Icon className="size-4 shrink-0" />
      <p className="flex-1">{message}</p>
      {online && (
        <button
          type="button"
          onClick={() =>
            void (failed > 0 ? syncEngine.retryFailed() : syncEngine.syncNow())
          }
          className="rounded-md border border-current px-2.5 py-1 text-xs font-medium hover:bg-black/5"
        >
          {failed > 0 ? "Retry" : "Sync now"}
        </button>
      )}
    </div>
  );
}
