import type { AntiPatternEntry, ConceptEntry, LexiconEntry } from "@pieai/university-core";

import { FavouritesScreen } from "../favourites/FavouritesScreen.js";
import type { FavouritesStore } from "../favourites/storage.js";
import { AntiPatternIndex } from "./AntiPatternIndex.js";
import { ConceptIndex } from "./ConceptIndex.js";
import { TermIndex } from "./TermIndex.js";

export const REFERENCE_TABS = ["concepts", "terms", "flavour", "favourites"] as const;
export type ReferenceTab = (typeof REFERENCE_TABS)[number];

const TAB_LABEL: Record<ReferenceTab, string> = {
  concepts: "概念图解",
  terms: "词义索引",
  flavour: "防 AI 味儿",
  favourites: "收藏",
};

/**
 * The one entrance to the reference collections.
 *
 * Both shells supply the same catalogues and account-backed favourite store;
 * only their route adapter decides what happens after an entry is opened.
 * Keeping the tabs and indexes here prevents the authoring shell from
 * degrading the delivery shell into an empty placeholder.
 */
export function LibrarySurface({
  activeTab,
  concepts,
  terms,
  antiPatterns,
  favourites,
  onBack,
  onTabChange,
  onOpenConcept,
  onOpenTerm,
  onOpenAntiPattern,
}: {
  readonly activeTab: ReferenceTab;
  readonly concepts: readonly ConceptEntry[];
  readonly terms: readonly LexiconEntry[];
  readonly antiPatterns: readonly AntiPatternEntry[];
  readonly favourites: FavouritesStore;
  readonly onBack: () => void;
  readonly onTabChange: (tab: ReferenceTab) => void;
  readonly onOpenConcept: (entry: ConceptEntry) => void;
  readonly onOpenTerm: (entry: LexiconEntry) => void;
  readonly onOpenAntiPattern: (entry: AntiPatternEntry) => void;
}) {
  return (
    <div className="terms">
      <button className="linkish" type="button" onClick={onBack}>
        ← 关卡地图
      </button>
      <nav className="library-tabs" aria-label="图鉴">
        {REFERENCE_TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={
              candidate === activeTab ? "library-tabs__tab is-current" : "library-tabs__tab"
            }
            aria-current={candidate === activeTab ? "page" : undefined}
            onClick={() => onTabChange(candidate)}
          >
            {TAB_LABEL[candidate]}
          </button>
        ))}
      </nav>
      {activeTab === "concepts" ? <ConceptIndex entries={concepts} onOpen={onOpenConcept} /> : null}
      {activeTab === "terms" ? <TermIndex entries={terms} onOpenFull={onOpenTerm} /> : null}
      {activeTab === "flavour" ? (
        <AntiPatternIndex entries={antiPatterns} onOpen={onOpenAntiPattern} />
      ) : null}
      {activeTab === "favourites" ? (
        <FavouritesScreen
          entries={terms}
          store={favourites}
          onOpen={(senseId) => {
            const entry = terms.find((candidate) => candidate.senseId === senseId);
            if (entry) onOpenTerm(entry);
          }}
        />
      ) : null}
    </div>
  );
}
