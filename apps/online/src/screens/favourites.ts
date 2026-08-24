import { useCallback, useEffect, useState } from "react";
import { toggleFavourite } from "@pieai/university-core";
import { createProgressFavouritesStore } from "@pieai/university-ui";
import { progressPort } from "../progress/store";

import { LEXICON } from "../lesson/language";

const LEXICON_SENSE_IDS = new Set(LEXICON.map((entry) => entry.senseId));

/**
 * One store for the whole session.
 *
 * Favourites are account data. The browser document remains the offline queue;
 * binding the same ProgressPort to the University cloud row makes this hook
 * behave identically in a second browser or shell.
 */
const favourites = createProgressFavouritesStore(progressPort);

export function useFavourites() {
  const [state, setState] = useState(() => favourites.read());
  useEffect(() => progressPort.subscribe(() => setState(favourites.read())), []);
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
