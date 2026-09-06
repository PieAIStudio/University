import { useSyncExternalStore } from "react";

export function pageIsVisible(): boolean {
  return typeof document === "undefined" || !document.hidden;
}

export function subscribePageVisibility(notify: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

/** One document lifecycle, shared by each independently owned viewport. */
export function usePageVisibility(): boolean {
  return useSyncExternalStore(subscribePageVisibility, pageIsVisible, () => true);
}
