import { useCallback, useState } from "react";
import { toggleFavourite } from "@pieai/university-core";
import { createLocalFavouritesStore } from "@pieai/university-ui";

import { LEXICON } from "../lesson/language";

const LEXICON_SENSE_IDS = new Set(LEXICON.map((entry) => entry.senseId));

/**
 * One store for the whole session.
 *
 * Favourites are a shortlist a learner builds by hand, so they must survive a
 * reload; they live in localStorage today and behind an interface, which is
 * what makes the account-backed version a different adapter rather than a
 * rewrite of everything that reads them.
 */
const favourites = createLocalFavouritesStore();

export function useFavourites() {
  const [state, setState] = useState(() => favourites.read());
  const toggle = useCallback((senseId: string) => {
    setState((current) => {
      // `now` is a parameter rather than something the model reads off the
      // clock, which is what makes the model pure and its tests reproducible.
      const next = toggleFavourite(current, senseId, LEXICON_SENSE_IDS, new Date().toISOString());
      favourites.write(next);
      return next;
    });
  }, []);
  return { state, toggle };
}
