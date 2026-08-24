import { ANTI_PATTERN_ENTRIES, CONCEPT_ENTRIES } from "@pieai/university-core";
import { LibrarySurface } from "@pieai/university-ui";

import { LEXICON } from "../lesson/language";
import { WORLD, type LibraryTab, type View } from "../url-state";
import { FAVOURITES_STORE } from "./FavouritesHost";

/**
 * One door for everything that is looked up rather than worked through.
 *
 * These were four top-bar buttons of equal weight, which is the arrangement the
 * product's own 「按钮」 entry warns about: several controls of the same weight
 * mean none of them is the answer. Worse, it made a claim that was not true —
 * that looking up a word, browsing a concept, checking a verbal tic and
 * re-reading a saved entry are four different kinds of activity. They are one,
 * and the three collections have shared one index component since SPEC-0004.
 *
 * Each tab renders the collection's existing adapter. There is no new index
 * here, and there must not be one.
 */
export function LibraryHost({ tab, onOpen }: { tab: LibraryTab; onOpen: (view: View) => void }) {
  return (
    <LibrarySurface
      activeTab={tab}
      concepts={CONCEPT_ENTRIES}
      terms={LEXICON}
      antiPatterns={ANTI_PATTERN_ENTRIES}
      favourites={FAVOURITES_STORE}
      onBack={() => onOpen(WORLD)}
      onTabChange={(next) => onOpen({ kind: "library", tab: next })}
      onOpenConcept={(entry) => onOpen({ kind: "concept", id: entry.head.id })}
      onOpenTerm={(entry) => onOpen({ kind: "term", senseId: entry.senseId })}
      onOpenAntiPattern={(entry) => onOpen({ kind: "anti-pattern-entry", id: entry.head.id })}
    />
  );
}
