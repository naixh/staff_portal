import { useSyncExternalStore } from "react";
import { subscribeSync, syncEngine } from "@/sync/engine";
import type { SyncStatus } from "@/sync/engine";

const getSnapshot = (): SyncStatus => syncEngine.getStatus();

/**
 * React hook returning the live sync engine status.
 * Re-renders whenever the engine publishes an update.
 */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, getSnapshot, getSnapshot);
}
