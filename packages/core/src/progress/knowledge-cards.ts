/**
 * The card album (V7 station 9): which knowledge cards the learner holds, and
 * how each is framed. The frame is the learner's memory made visible — silver
 * when just collected, violet with a gem once it holds up in review, gold with
 * a crown three weeks on — so collecting the rare cards is the same act as
 * reviewing. "Three weeks" is the product's existing long-term line, not a new
 * one.
 */
import type { CardProgress } from "../ports/progress.js";
import { LONG_TERM_STABILITY_DAYS } from "./goals.js";

export type KnowledgeCardTier = "new" | "known" | "shining";

/**
 * Collected before anything is studied (V7 mechanic 9): a loyalty card that
 * arrives with two stamps gets finished. 提示词, and 「AI 应用基础」 for the design's
 * 「AI 是什么」.
 */
export const HEAD_START_CONCEPTS = ["prompt", "ai-basics"] as const;

/** The album and Backend registration must describe the exact same set.
 * A source with no authored links has no set. Gifts join the first segment
 * of the default AI course only when it has authored links; access is not memory.
 */
export function knowledgeSetConceptIds(
  named: readonly string[],
  known: ReadonlySet<string>,
  location: { readonly domainId: string; readonly isDefault: boolean; readonly ordinal: number },
): readonly string[] {
  const concepts = [...new Set(named)].filter((id) => known.has(id));
  if (
    concepts.length &&
    location.domainId === "ai-foundations" &&
    location.isDefault &&
    location.ordinal === 1
  ) {
    concepts.unshift(
      ...HEAD_START_CONCEPTS.filter((id) => known.has(id) && !concepts.includes(id)),
    );
  }
  return concepts;
}

/** FSRS's own state for a card that has graduated from learning into review. */
const FSRS_REVIEW = 2;

/**
 * A concept's frame, from the review cards that carry it: shining once any
 * of them will still be recalled three weeks on, known once one has come
 * through review, new otherwise (including a head-start card with no cards).
 */
export function knowledgeCardTier(cards: readonly CardProgress[]): KnowledgeCardTier {
  if (cards.some((card) => card.fsrs.stability >= LONG_TERM_STABILITY_DAYS)) return "shining";
  if (cards.some((card) => card.fsrs.state === FSRS_REVIEW && card.fsrs.lapses < card.fsrs.reps))
    return "known";
  return "new";
}

/** The three pips under a card: how far along its frame is. */
export function knowledgeCardPips(tier: KnowledgeCardTier): { filled: number; total: 3 } {
  return { filled: tier === "shining" ? 3 : tier === "known" ? 2 : 1, total: 3 };
}

/** The concepts the learner holds: the head start plus every one a finished lesson names. */
export function collectedConcepts(namedByFinishedLessons: Iterable<string>): ReadonlySet<string> {
  return new Set<string>([...HEAD_START_CONCEPTS, ...namedByFinishedLessons]);
}
