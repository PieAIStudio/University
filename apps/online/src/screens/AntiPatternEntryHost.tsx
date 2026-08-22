import { antiPatternHeadToMarkdown, getAntiPatternEntry } from "@pieai/university-core";
import { EntryPage } from "@pieai/university-ui";

import type { View } from "../url-state";
import { LEXICON_BY_SENSE } from "./lexicon-by-sense";

/**
 * One anti-pattern, rendered by the same EntryPage a term uses.
 *
 * That reuse is the point rather than a saving. SPEC-0004 says a second detail
 * page for this collection is the design failing, because the two pages would
 * drift on the day someone adds a section type to one of them.
 */
export function AntiPatternEntryHost({ id, onOpen }: { id: string; onOpen: (view: View) => void }) {
  const entry = getAntiPatternEntry(id);
  if (!entry) {
    return (
      <main className="terms">
        <button className="linkish" onClick={() => onOpen({ kind: "anti-pattern" })}>
          ← 防 AI 味儿
        </button>
        <p className="reference-panel__note">没有这一条。</p>
      </main>
    );
  }
  return (
    <main className="terms">
      <EntryPage
        breadcrumb={[{ label: "防 AI 味儿", href: "#/flavour" }, { label: entry.head.name }]}
        head={
          <>
            <h1>{entry.head.name}</h1>
            <p className="reference-panel__gloss">{entry.head.complaint}</p>
          </>
        }
        sections={entry.sections}
        headMarkdown={antiPatternHeadToMarkdown(entry.head)}
        lexicon={LEXICON_BY_SENSE}
        onOpenSense={(senseId) => onOpen({ kind: "term", senseId })}
      />
    </main>
  );
}
