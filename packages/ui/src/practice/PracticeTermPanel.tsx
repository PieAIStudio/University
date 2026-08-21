import type { LexiconEntry, TermPracticeQuestion } from "@pieai/university-core";

import { TermEntryPage } from "../entry/EntryPage.js";

export const PRACTICE_UNLOCK_HINT = "答对后查看完整术语详情";

/**
 * The right-hand reward of a sitting.
 *
 * Locked, this is a mask and nothing else — not a blurred `TermEntryPage`.
 * Rendering the entry underneath the overlay would let a curious DOM reader
 * (or a learner who resizes the panel) see the answer they are meant to
 * judge first. Unlocked, it is the existing entry page in place: SPEC-0004
 * forbids a second detail view for the same term.
 */
export function PracticeTermPanel({
  question,
  unlocked,
  lexicon,
  onOpenSense,
  collectionHref,
}: {
  readonly question: TermPracticeQuestion;
  readonly unlocked: boolean;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly onOpenSense?: (senseId: string) => void;
  readonly collectionHref?: string;
}) {
  return (
    <aside
      className={unlocked ? "practice-term-panel" : "practice-term-panel is-locked"}
      aria-label={unlocked ? "术语详情" : "未解锁的术语详情"}
    >
      {unlocked ? (
        <div className="practice-term-panel__entry">
          <TermEntryPage
            entry={question.term}
            collectionHref={collectionHref}
            lexicon={lexicon}
            onOpenSense={onOpenSense}
          />
        </div>
      ) : (
        <div className="practice-term-panel__mask" role="status">
          <svg
            className="practice-term-panel__icon"
            viewBox="0 0 24 24"
            width="48"
            height="48"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A11 11 0 0 1 12 5c5 0 9.2 4 10 7-.4 1.2-1.2 2.5-2.4 3.6M6.2 6.3C4.4 7.6 3.1 9.3 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 3.9-.9"
            />
          </svg>
          <p>{PRACTICE_UNLOCK_HINT}</p>
        </div>
      )}
    </aside>
  );
}
