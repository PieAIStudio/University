import {
  LIBRARY_TABS,
  type AntiPatternEntry,
  type ConceptEntry,
  type LexiconEntry,
  type LibraryTab,
} from "@pieai/university-core";
import { GameSegmentedControl } from "@pieai/swimmer-ui-kit";

import { FavouritesScreen } from "../favourites/FavouritesScreen.js";
import type { FavouritesStore } from "../favourites/storage.js";
import type { KnowledgeNoteView } from "../view/lesson-view.js";
import { AntiPatternIndex } from "./AntiPatternIndex.js";
import { ConceptIndex } from "./ConceptIndex.js";
import { KnowledgeNotes } from "./KnowledgeNotes.js";
import { TermIndex } from "./TermIndex.js";

/*
  One list of tabs, and it is the router's.

  There were two — this one and `LIBRARY_TABS` in `core` — holding the same
  four strings, so a fifth collection was two edits, and the version of this
  file that had only made one of them would have routed to a tab it did not
  draw, or drawn a tab no address could reach. They are the same list because
  they are the same question.
*/
export const REFERENCE_TABS = LIBRARY_TABS;
export type ReferenceTab = LibraryTab;

const TAB_LABEL: Record<ReferenceTab, string> = {
  concepts: "概念图解",
  terms: "词义索引",
  flavour: "防 AI 味儿",
  favourites: "收藏",
  notes: "课堂笔记",
};

const REFERENCE_TAB_OPTIONS = REFERENCE_TABS.map((id) => ({
  id,
  label: TAB_LABEL[id],
}));

function isReferenceTab(id: string): id is ReferenceTab {
  return (REFERENCE_TABS as readonly string[]).includes(id);
}

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
  notes,
  notesBasePathOf,
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
  /**
   * What this learner kept from arguing with an AI host.
   *
   * Empty in a build whose packages do not carry notes yet, which is the same
   * shape as any collection with nothing in it — the tab is there, it says so,
   * and it fills in when the export pipeline starts shipping them.
   */
  readonly notes: readonly KnowledgeNoteView[];
  /** Where a note's evidence is fetched from, in this build. */
  readonly notesBasePathOf: (note: KnowledgeNoteView) => string;
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
        <GameSegmentedControl
          label="图鉴"
          activeId={activeTab}
          options={REFERENCE_TAB_OPTIONS}
          onSelect={(id) => {
            if (isReferenceTab(id)) onTabChange(id);
          }}
        />
      </nav>
      {activeTab === "concepts" ? <ConceptIndex entries={concepts} onOpen={onOpenConcept} /> : null}
      {activeTab === "terms" ? <TermIndex entries={terms} onOpenFull={onOpenTerm} /> : null}
      {activeTab === "flavour" ? (
        <AntiPatternIndex entries={antiPatterns} onOpen={onOpenAntiPattern} />
      ) : null}
      {activeTab === "notes" ? (
        <KnowledgeNotes notes={notes} basePathOf={notesBasePathOf} panelIdPrefix="library-note" />
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
