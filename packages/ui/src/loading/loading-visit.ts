/**
 * First visit vs later visits for the map-loading overlay.
 *
 * Unreadable storage (private window, disabled site data, missing
 * `localStorage`) is a first visit: a stranger seeing a random catalogue
 * entry is worse than a returning learner seeing the intro once more.
 *
 * The decision is cached for the JS session so a Strict Mode remount, or
 * a second overlay in the same load, cannot flip to a concept after the
 * intro was already chosen. Persistence is for the *next* page load.
 */

export type LoadingVisit = "first" | "returning";

export type LoadingStorage = Pick<Storage, "getItem" | "setItem">;

export const LOADING_INTRO_SEEN_KEY = "university.loading.intro-seen";

let sessionVisit: LoadingVisit | null = null;

function probeStorage(): LoadingStorage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    storage.getItem(LOADING_INTRO_SEEN_KEY);
    return storage;
  } catch {
    return null;
  }
}

function fromStorage(storage: LoadingStorage | null): LoadingVisit {
  if (!storage) return "first";
  try {
    return storage.getItem(LOADING_INTRO_SEEN_KEY) === "1" ? "returning" : "first";
  } catch {
    return "first";
  }
}

/**
 * @param storage `undefined` uses `localStorage` when it can be read;
 * `null` is an explicit unreadable store and counts as a first visit.
 */
export function readLoadingVisit(storage?: LoadingStorage | null): LoadingVisit {
  if (sessionVisit !== null) return sessionVisit;
  const resolved = storage === undefined ? probeStorage() : storage;
  sessionVisit = fromStorage(resolved);
  return sessionVisit;
}

export function markLoadingIntroSeen(storage?: LoadingStorage | null): void {
  const resolved = storage === undefined ? probeStorage() : storage;
  if (!resolved) return;
  try {
    resolved.setItem(LOADING_INTRO_SEEN_KEY, "1");
  } catch {
    // Still a first visit next time, which is the stranger-safe direction.
  }
}

/** Test-only: a new "session" so visit tests do not leak across cases. */
export function resetLoadingVisitForTests(): void {
  sessionVisit = null;
}
