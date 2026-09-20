import { useSyncExternalStore } from "react";

const queries = new WeakMap<Window, { matchMedia: Window["matchMedia"]; media: MediaQueryList }>();

function preferenceQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  const cached = queries.get(window);
  if (cached?.matchMedia === window.matchMedia) return cached.media;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  queries.set(window, { matchMedia: window.matchMedia, media });
  return media;
}

export function reducedMotionNow(): boolean {
  return preferenceQuery()?.matches ?? false;
}

export function subscribeReducedMotion(notify: () => void): () => void {
  const media = preferenceQuery();
  if (!media) return () => {};
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

const serverSnapshot = () => false;

/** Media state belongs to the browser, not a deferred React-state copy.
 * One reusable query per window; every mounted consumer releases its listener.
 * External-store updates are synchronous, including inside the R3F root.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, serverSnapshot);
}
