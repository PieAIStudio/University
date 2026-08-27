import {
  EntryPage,
  PracticeSurface,
  createProgressPracticeRecentStore,
} from "@pieai/university-ui";
import { conceptHeadToMarkdown } from "@pieai/university-core";

import { WORLD, type View } from "@pieai/university-core";
import { CONCEPT_POINTERS } from "./concept-pointers";
import { LEXICON_BY_SENSE } from "./lexicon-by-sense";
import { progressPort } from "../progress/store";
import { LEXICON } from "../lesson/language";

/**
 * The endless sitting, drawing on the questions the concept entries already
 * carry.
 *
 * There is no second question bank and there is not going to be one. Every
 * question here is the same record the entry's own 「小测」 renders, which is
 * the architecture worth copying from the site this catalogue came from: their
 * question ids prove the practice bank *is* the per-entry quiz. A separate
 * corpus would drift from the entries within one authoring pass.
 *
 * The reward is the concept page itself, passed as a render prop, because
 * SPEC-0004 forbids a second detail page for a collection that already has one.
 */
export function PracticeHost({ onOpen }: { onOpen: (view: View) => void }) {
  return (
    <PracticeSurface
      store={PRACTICE_STORE}
      lexicon={LEXICON}
      onOpenWorld={() => onOpen(WORLD)}
      onBrowse={() => onOpen({ kind: "concepts" })}
      renderReward={(question) => (
        <EntryPage
          breadcrumb={[{ label: "概念图解", href: "/concepts" }, { label: question.entry.head.zh }]}
          head={
            <>
              <h1>{question.entry.head.zh}</h1>
              <p className="reference-panel__gloss">{question.entry.head.tagline}</p>
            </>
          }
          sections={question.entry.sections}
          headMarkdown={conceptHeadToMarkdown(question.entry.head)}
          lexicon={LEXICON_BY_SENSE}
          {...CONCEPT_POINTERS(onOpen)}
        />
      )}
    />
  );
}

/** One store for the whole session, same shape as the favourites store. */
const PRACTICE_STORE = createProgressPracticeRecentStore(progressPort);
