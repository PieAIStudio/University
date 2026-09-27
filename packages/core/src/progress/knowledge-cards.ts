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
