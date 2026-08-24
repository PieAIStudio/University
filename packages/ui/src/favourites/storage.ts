import {
  EMPTY_FAVOURITES,
  parseFavourites,
  type FavouritesState,
  type ProgressPort,
} from "@pieai/university-core";

/**
 * Legacy browser adapter for a learner's starred senses.
 *
 * A favourite is a fact about this person — which senses they want back —
 * not a way of reading a lesson, so it belongs on the account. The shared
 * `createProgressFavouritesStore` below is the canonical adapter; this one is
 * retained only to migrate old browser profiles and to keep isolated tests
 * useful.
 *
 * A blocked or full browser store still gets the toggle; the cloud-backed
 * adapter queues the same document through ProgressPort instead.
 *
 * The key is product-level, not `university-local`, because both shells
 * will read this list and the account adapter will keep the same document
 * identity. The version lives *inside* the JSON so a migration branches on
 * `version` rather than growing `university.favourites.v2`.
 */
export const FAVOURITES_STORAGE_KEY = "university.favourites";

/**
 * The only thing a UI or a shell is allowed to ask of a favourites backend.
 *
 * Narrow on purpose. Listing, grouping and toggling are the model's job;
 * this interface is how the document crosses a process boundary.
 */
export interface FavouritesStore {
  read(): FavouritesState;
  write(state: FavouritesState): void;
  subscribe?(listener: () => void): () => void;
}

export function readLocalFavourites(): FavouritesState {
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    if (!raw) return EMPTY_FAVOURITES;
    return parseFavourites(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_FAVOURITES;
  }
}

export function writeLocalFavourites(state: FavouritesState): void {
  try {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A browser with storage disabled still gets the star, just not the memory.
  }
}

export function createLocalFavouritesStore(): FavouritesStore {
  return {
    read: readLocalFavourites,
    write: writeLocalFavourites,
  };
}

/** The account-backed adapter shared by both browser shells. */
export function createProgressFavouritesStore(progress: ProgressPort): FavouritesStore {
  return {
    read: () => progress.accountData().favourites,
    write: (state) => progress.setFavourites(parseFavourites(state)),
    subscribe: progress.subscribe,
  };
}
