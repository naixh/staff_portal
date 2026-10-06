import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  const goOnline = () => callback();
  const goOffline = () => callback();
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  };
}

let snapshot = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

export function getSnapshot(): boolean {
  return snapshot();
}

/** React hook that re-renders when the device goes online/offline. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
