/**
 * The one `localStorage` Persistence both browser shells inject.
 *
 * Core owns `Persistence` and `createProgressPort`, and it is not allowed a
 * `window` — the authoring server imports that package as real JavaScript,
 * and a store that closed over `localStorage` would stop being something a
 * Node process could load. The bytes still have to live somewhere on this
 * machine until SwimmerBackend has a University row, so the adapter sits
 * here, next to the other browser stores (favourites, practice, sound).
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
      try {
        window.localStorage.setItem(PROGRESS_STORAGE_KEY, raw);
      } catch {
        // Private browsing, or a full quota. Losing the write is survivable;
        // throwing in the middle of a lesson is not.
      }
    },
  };
}
