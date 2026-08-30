import { translate } from "../i18n/index.js";
/**
 * The one place that says there is nothing due.
 *
 * Both shells reach this state and both used to write it out themselves. They
 * had already drifted:
 *
 *   online — 「学一节新课，它会掉落新的卡片，明天就有事做了。」
 *   local  — 「完成上面的课程后，新卡片会进入 FSRS 复习安排。」
 *
 * Same fact, and only one of them is addressed to a learner. FSRS is the name
 * of the scheduling algorithm; nobody studying here agreed to learn it, and a
 * sentence that leaks it is telling them about our implementation instead of
 * about their day. That is what two copies of a sentence always turn into —
 * not a contradiction anyone would catch in review, just one of them slowly
 * becoming a note to the engineer who wrote it.
 *
 * The chrome around these words still belongs to each shell: the delivery
 * shell needs a way back to the map, the authoring shell renders it as a
 * callout under the lesson it is already pointing at. The words do not.
 */
export const REVIEW_EMPTY_TITLE = translate("ui.review.reviewempty.copy.今天没有到期卡片");

/**
 * `hasMoreToLearn` is the difference between "come back tomorrow" and "you are
 * actually finished today". Reading the first when the second is true would be
 * telling someone to go and do work that does not exist.
 */
export function reviewEmptyDescription(hasMoreToLearn: boolean): string {
  return hasMoreToLearn
    ? translate("ui.review.reviewempty.copy.学一节新课-它会掉落新的卡片-明天就有事做了")
    : translate("ui.review.reviewempty.copy.今天的复习已经清空");
}
