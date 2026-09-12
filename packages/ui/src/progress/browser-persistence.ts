/**
 * The one `localStorage` Persistence both browser shells inject.
 *
 * Core owns `Persistence` and `createProgressPort`, and it is not allowed a
 * `window` — the authoring server imports that package as real JavaScript,
 * and a store that closed over `localStorage` would stop being something a
 * Node process could load. The bytes still have to live somewhere on this
 * machine until SwimmerBackend has a University row, so the adapter sits
 * here, next to the other browser stores (favourites, practice, sound). It is
 * a cache/outbox, not the account's cross-device source of truth.
 *
 * Copying the eighteen lines into `apps/local` would have compiled. It
 * would also have been two implementations of the same try/catch, and the
 * next private-browsing fix would land in one shell and not the other.
 * `read` returning null on any failure is the same contract as those other
 * stores: a blocked quota must not take a lesson down with it.
 */
import { PROGRESS_STORAGE_KEY, type Persistence } from "@pieai/university-core";

export function createBrowserPersistence(): Persistence {
  return {
    read(): string | null {
      try {
        return window.localStorage.getItem(PROGRESS_STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(raw: string) {
      // Core catches this at the mutation boundary and retains the live data.
      // Swallowing it here would make a failed cache write look successful.
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, raw);
    },
    readAccount(userId: string) {
      try {
        return window.localStorage.getItem(
          `${PROGRESS_STORAGE_KEY}.account.${encodeURIComponent(userId)}`,
        );
      } catch {
        return null;
      }
    },
    writeAccount(userId: string, raw: string) {
      window.localStorage.setItem(
        `${PROGRESS_STORAGE_KEY}.account.${encodeURIComponent(userId)}`,
        raw,
      );
    },
  };
}
