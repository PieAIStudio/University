/**
 * What the moments in this product sound like.
 *
 * This is a table on purpose, and it is the same idea as `kit.tsx`'s material
 * repaint table: sound design that lives scattered across twenty call sites is
 * sound design nobody can argue with. Here it is one file, one screenful, and
 * changing what "you got it right" sounds like is a one-line diff.
 *
 * The left column is a *product moment*. The right column is a cue name from
 * the `uisfx` vocabulary. Call sites name the moment and never the cue, so the
 * pack, the vocabulary and the mix can all change without touching a component.
 *
 * On the vocabulary: `uisfx` ships 78 semantic cues and we use fifteen. The
 * unused sixty-three are not waste — they are the reason a moment we add next
 * month probably already has a sound, instead of a synthesiser recipe someone
 * has to invent at 1am.
 */
import type { CueName } from "uisfx";

/**
 * Every moment this product is allowed to make a noise at.
 *
 * Adding a member here is a design decision and should read like one. A moment
 * that is not in this union cannot be sounded, which is the point: silence is
 * the default and each exception is written down.
 */
export type SoundMoment =
  // Answering. The three outcomes of tier-one grading, and they must sound
  // different from each other — an "undecided" that sounds like a "wrong" is
  // the grader lying with tone instead of with words.
  | "answer.correct"
  | "answer.wrong"
  | "answer.undecided"
  // Reward. Cards drop, settlements grow, courses finish. These escalate.
  | "reward.card"
  | "reward.built"
  | "reward.course"
  | "reward.streak"
  // The world map.
  | "map.hover"
  | "map.select"
  // Review.
  | "review.graded"
  // Navigation and panels. The quietest tier — these fire often, so anything
  // with a tail or a melody is wrong here.
  | "nav.back"
  | "panel.open"
  | "panel.close"
  | "word.staged"
  | "ui.press";

/**
 * The moment-to-cue map.
 *
 * Read the comments as the design rationale; they are why a given cue and not
 * a louder neighbour.
 */
export const CUE_FOR: Readonly<Record<SoundMoment, CueName>> = {
  // `success` rather than `achievement`: getting one answer right is the
  // expected case, not a trophy. Saving the trophy sounds for real milestones
  // is what keeps them worth anything.
  "answer.correct": "success",
  // `warning`, not `error`. The learner did not break the software; they got a
  // question wrong, which is the entire mechanism by which this product works.
  // `error` is reserved for the product actually failing.
  "answer.wrong": "warning",
  // The grader could not decide. That is the product's limitation, so it gets
  // the neutral informational cue rather than anything that scores the answer.
  "answer.undecided": "info",
  "reward.card": "reward",
  // A settlement grew: a checkpoint, not a fanfare. It happens every lesson.
  "reward.built": "checkpoint",
  // Finishing a course is the rarest thing a learner does. It gets the loudest
  // cue in the vocabulary, and it is the only place that cue is used.
  "reward.course": "achievement",
  "reward.streak": "streak",
  "map.hover": "hover",
  "map.select": "select",
  "review.graded": "progress-step",
  "nav.back": "back",
  "panel.open": "open",
  "panel.close": "close",
  // Putting a word into review is a small commitment, so it gets a small,
  // definite click rather than anything congratulatory.
  "word.staged": "check",
  "ui.press": "press",
};

/**
 * Moments quiet enough to fire on movement rather than intent.
 *
 * Hover fires whenever a pointer crosses an island. At full mix that is not
 * ambience, it is a woodpecker. These play at a fraction of the level and are
 * the first thing dropped when a learner turns the volume down.
 */
export const INCIDENTAL: ReadonlySet<SoundMoment> = new Set<SoundMoment>([
  "map.hover",
  "ui.press",
  "panel.open",
  "panel.close",
  "nav.back",
]);
