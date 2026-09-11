import type { IdentityStatus, ProgressDocument } from "@pieai/university-core";

/** Navigation acknowledgement only; never an account, lesson completion or learning record. */
export const WELCOME_STORAGE_KEY = "university.welcome.v1";
type WelcomeStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): WelcomeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readWelcomeAcknowledged(
  storage: WelcomeStorage | null = browserStorage(),
): boolean {
  try {
    return storage?.getItem(WELCOME_STORAGE_KEY) === "acknowledged";
  } catch {
    return false;
  }
}

export function writeWelcomeAcknowledged(
  storage: WelcomeStorage | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(WELCOME_STORAGE_KEY, "acknowledged");
    return true;
  } catch {
    // The caller dismisses in memory regardless. Storage must never lock this door.
    return false;
  }
}

export function isWelcomeEntry(url: URL): boolean {
  if (url.pathname !== "/" || (url.hash !== "" && url.hash !== "#/")) return false;
  // Shared lesson links, auth callbacks and renderer diagnostics own their destination.
  return [...url.searchParams.keys()].every((key) => key.startsWith("utm_"));
}

export function shouldShowWelcome(options: {
  readonly entryEligible: boolean;
  readonly acknowledged: boolean;
  readonly identityKind: IdentityStatus["kind"];
  readonly progress: ProgressDocument;
}): boolean {
  if (!options.entryEligible || options.acknowledged) return false;
  if (!["signed_out", "unconfigured", "error"].includes(options.identityKind)) return false;
  const progress = options.progress;
  return (
    progress.totalXp === 0 &&
    Object.keys(progress.lessons).length === 0 &&
    Object.keys(progress.exerciseAttempts).length === 0 &&
    Object.keys(progress.cards).length === 0 &&
    Object.keys(progress.words).length === 0 &&
    Object.keys(progress.readerMarks).length === 0
  );
}
