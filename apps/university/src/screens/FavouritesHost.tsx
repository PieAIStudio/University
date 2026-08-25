import { FavouritesScreen, createProgressFavouritesStore } from "@pieai/university-ui";

import { LEXICON } from "../lesson/language";
import type { View } from "@pieai/university-core";
import { progressPort } from "../progress/store";

/** The learner's shortlist, grouped the same way the index groups. */
export function FavouritesHost({ onOpen }: { onOpen: (view: View) => void }) {
  return (
    <FavouritesScreen
      entries={LEXICON}
      store={FAVOURITES_STORE}
      onOpen={(senseId) => onOpen({ kind: "term", senseId })}
      onBrowse={() => onOpen({ kind: "library", tab: "terms" })}
    />
  );
}

export const FAVOURITES_STORE = createProgressFavouritesStore(progressPort);
