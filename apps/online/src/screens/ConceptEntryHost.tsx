import { conceptHeadToMarkdown, conceptNeighbours, getConceptEntry } from "@pieai/university-core";
import { EntryPage } from "@pieai/university-ui";

import type { View } from "../url-state";
import { CONCEPT_POINTERS } from "./concept-pointers";
import { LEXICON_BY_SENSE } from "./lexicon-by-sense";

/**
 * One concept, on the same EntryPage a term and an anti-pattern use.
 *
 * Third collection, third head adapter, still one page component — which is
 * the claim SPEC-0004 made and this is the first time it has been tested by a
 * collection large enough to tempt someone into a special case.
 *
 * It is also the first page to pass `neighbours`. C23 shipped unmounted, and an
 * unmounted component is a component nobody has checked.
 */
export function ConceptEntryHost({ id, onOpen }: { id: string; onOpen: (view: View) => void }) {
  const entry = getConceptEntry(id);
  if (!entry) {
    return (
      <main className="terms">
        <button className="linkish" onClick={() => onOpen({ kind: "concepts" })}>
          ← 概念图解
        </button>
        <p className="reference-panel__note">没有这一条。</p>
      </main>
    );
  }
  const { previous, next } = conceptNeighbours(id);
  return (
    <main className="terms">
      <EntryPage
        breadcrumb={[
          { label: "概念图解", href: "#/concepts" },
          { label: entry.head.group },
          { label: entry.head.zh },
        ]}
        head={
          <>
            <h1>
              {entry.head.zh}
              {entry.head.en ? (
                <span className="reference-panel__pos" lang="en">
                  {entry.head.en}
                </span>
              ) : null}
            </h1>
            <p className="reference-panel__gloss">{entry.head.tagline}</p>
          </>
        }
        sections={entry.sections}
        headMarkdown={conceptHeadToMarkdown(entry.head)}
        lexicon={LEXICON_BY_SENSE}
        {...CONCEPT_POINTERS(onOpen)}
        neighbours={{
          previous: previous
            ? {
                label: previous.head.zh,
                onOpen: () => onOpen({ kind: "concept", id: previous.head.id }),
              }
            : null,
          next: next
            ? { label: next.head.zh, onOpen: () => onOpen({ kind: "concept", id: next.head.id }) }
            : null,
        }}
      />
    </main>
  );
}
