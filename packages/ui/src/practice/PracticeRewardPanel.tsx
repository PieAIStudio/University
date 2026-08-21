import type { ReactNode } from "react";

/*
  Names no collection. This stream draws on whichever collections carry
  questions — today the 281 concept entries, tomorrow the lexicon — and copy
  that says 「术语」 is wrong on every screen except one.
*/
export const PRACTICE_UNLOCK_HINT = "答对后展开完整内容";

/**
 * The right-hand reward of a sitting.
 *
 * Locked, this is a mask and nothing else — not a blurred entry page.
 * Rendering the entry underneath the overlay would let a curious DOM reader
 * (or a learner who resizes the panel) see the answer they are meant to
 * judge first. Unlocked, it renders whatever the caller passed: SPEC-0004
 * forbids a second detail view, so the reward must be the existing page for
 * that collection, and this panel does not know which page that is.
 */
export function PracticeRewardPanel({
  unlocked,
  children,
}: {
  readonly unlocked: boolean;
  readonly children: ReactNode;
}) {
  return (
    <aside
      className={unlocked ? "practice-reward-panel" : "practice-reward-panel is-locked"}
      aria-label={unlocked ? "完整内容" : "答对后展开的完整内容"}
    >
      {unlocked ? (
        <div className="practice-reward-panel__entry">{children}</div>
      ) : (
        <div className="practice-reward-panel__mask" role="status">
          <svg
            className="practice-reward-panel__icon"
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
