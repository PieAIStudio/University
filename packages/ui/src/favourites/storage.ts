import { EMPTY_FAVOURITES, parseFavourites, type FavouritesState } from "@pieai/university-core";

/**
 * Where a learner's starred senses live, for now.
 *
 * A favourite is a fact about this person — which senses they want back —
 * not a way of reading a lesson, so it belongs on the account. The account
 * store does not exist yet. This adapter is the stand-in: the same document
 * the model already speaks, the same `read`/`write` an account client will
 * implement, so swapping storage later does not rewrite the star button.
 *
 * The bytes sit in the browser until that swap. A blocked or full store
 * still gets the toggle; it just does not remember. That is the same
 * contract as the reading-mode switch, for the same reason: a preference
 * control that throws takes the page down with it.
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
