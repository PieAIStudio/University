import { ANTI_PATTERN_ENTRIES, CONCEPT_ENTRIES } from "@pieai/university-core";
import { AntiPatternIndex, ConceptIndex, TermIndex } from "@pieai/university-ui";

import { LEXICON } from "../lesson/language";
import { LIBRARY_TABS, WORLD, type LibraryTab, type View } from "../url-state";
import { FavouritesHost } from "./FavouritesHost";

const LIBRARY_TAB_LABEL: Record<LibraryTab, string> = {
  concepts: "概念图解",
  terms: "词义索引",
  flavour: "防 AI 味儿",
  favourites: "收藏",
};

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
    <div className="terms">
      <button className="linkish" onClick={() => onOpen(WORLD)}>
        ← 关卡地图
      </button>
      <nav className="library-tabs" aria-label="图鉴">
        {LIBRARY_TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={candidate === tab ? "library-tabs__tab is-current" : "library-tabs__tab"}
            aria-current={candidate === tab ? "page" : undefined}
            onClick={() => onOpen({ kind: "library", tab: candidate })}
          >
            {LIBRARY_TAB_LABEL[candidate]}
          </button>
        ))}
      </nav>
      {tab === "concepts" ? (
        <ConceptIndex
          entries={CONCEPT_ENTRIES}
          onOpen={(entry) => onOpen({ kind: "concept", id: entry.head.id })}
        />
      ) : null}
      {tab === "terms" ? (
        <TermIndex
          entries={LEXICON}
          onOpenFull={(entry) => onOpen({ kind: "term", senseId: entry.senseId })}
        />
      ) : null}
      {tab === "flavour" ? (
        <AntiPatternIndex
          entries={ANTI_PATTERN_ENTRIES}
          onOpen={(entry) => onOpen({ kind: "anti-pattern-entry", id: entry.head.id })}
        />
      ) : null}
      {tab === "favourites" ? <FavouritesHost onOpen={onOpen} /> : null}
    </div>
  );
}
