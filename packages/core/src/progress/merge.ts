/**
 * Two machines, one person, one document.
 *
 * A learner who opens the app on a phone and a laptop will fork. Pretending
 * they will not is how progress disappears: the second device wins, the first
 * day's work is gone, and nothing looks broken from the outside because the
 * second device still has *a* record.
 *
 * This merge is a union of knowledge. It never takes a less-advanced lesson
 * over a more-advanced one, and it never drops a card or a word that only one
 * side has. It is commutative and idempotent so a retry after a dropped save
 * does not thrash the document.
 *
 * Rules, and why each one is not the other choice:
 *
 * Lessons. `progress` is max, because a lesson only ever rises (see the
 * mutator). `completedAt` is the earliest non-null timestamp: the first time
 * they finished it is the fact, a later machine repeating it is not a new
 * finish. `attempts` is max, not sum — summing after a sync would count the
 * same sitting twice.
 *
 * Cards. Both sides keep the card if either has it. When both have it, the
 * record with more FSRS `reps` wins; if those tie, the later `last_review`;
 * if those tie, the later `dueAt`. More reps is more of the learner's actual
 * history. A later due date is the usual companion of that history — it is
 * the example in the account brief — and taking the earlier due date would
 * throw them back into a queue they already cleared on the other machine.
 * Taking the less-reviewed record would throw the reviews away.
 *
 * Words. `learning` outranks `familiar` outranks `paused`. A fork that is
 * still reviewing a word must not be silenced by a fork that retired it. Two
 * `learning` rows pick by the same card rule. Lapses are max.
 *
 * Streak. The later calendar day wins; on the same day, the higher count.
 * A streak is a fact about *this person's* recent days, and the machine that
 * was used more recently is the one that knows.
 */

import type {
  CardProgress,
  LessonProgress,
  ProgressDocument,
  WordProgress,
} from "../ports/progress.js";
import { cloneProgress, emptyProgress } from "./document.js";

const WORD_RANK: Record<WordProgress["stage"], number> = {
  paused: 0,
  familiar: 1,
  learning: 2,
};

export function mergeProgress(
  left: ProgressDocument | null,
  right: ProgressDocument | null,
): ProgressDocument {
  if (!left && !right) return emptyProgress();
  if (!left) return cloneProgress(right!);
  if (!right) return cloneProgress(left);

  const lessons: Record<string, LessonProgress> = { ...left.lessons };
  for (const [key, other] of Object.entries(right.lessons)) {
    const current = lessons[key];
    lessons[key] = current ? mergeLesson(current, other) : { ...other };
  }

  const cards: Record<string, CardProgress> = { ...left.cards };
  for (const [key, other] of Object.entries(right.cards)) {
    const current = cards[key];
    cards[key] = current ? pickCard(current, other) : { ...other };
  }

  const words: Record<string, WordProgress> = { ...left.words };
  for (const [key, other] of Object.entries(right.words)) {
    const current = words[key];
    words[key] = current ? mergeWord(current, other) : { ...other };
  }

  return {
    lessons,
    cards,
    words,
    streak: mergeStreak(left.streak, right.streak),
  };
}

function mergeLesson(a: LessonProgress, b: LessonProgress): LessonProgress {
  const progress = Math.max(a.progress, b.progress);
  const completedAt =
    a.completedAt == null
      ? b.completedAt
      : b.completedAt == null
        ? a.completedAt
        : Math.min(a.completedAt, b.completedAt);
  return {
    progress,
    completedAt,
    attempts: Math.max(a.attempts, b.attempts),
  };
}

function pickCard(a: CardProgress, b: CardProgress): CardProgress {
  if (a.fsrs.reps !== b.fsrs.reps) return a.fsrs.reps > b.fsrs.reps ? a : b;
  const aReview = reviewedAt(a);
  const bReview = reviewedAt(b);
  if (aReview !== bReview) return aReview > bReview ? a : b;
  return a.dueAt >= b.dueAt ? a : b;
}

function reviewedAt(card: CardProgress): number {
  if (!card.fsrs.last_review) return 0;
  const parsed = Date.parse(card.fsrs.last_review);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mergeWord(a: WordProgress, b: WordProgress): WordProgress {
  const aRank = WORD_RANK[a.stage];
  const bRank = WORD_RANK[b.stage];
  const winner = aRank !== bRank ? (aRank > bRank ? a : b) : pickLearningWord(a, b);
  return {
    ...winner,
    lapses: Math.max(a.lapses, b.lapses),
  };
}

function pickLearningWord(a: WordProgress, b: WordProgress): WordProgress {
  const aReps = a.fsrs?.reps ?? 0;
  const bReps = b.fsrs?.reps ?? 0;
  if (aReps !== bReps) return aReps > bReps ? a : b;
  const aDue = a.dueAt ?? 0;
  const bDue = b.dueAt ?? 0;
  return aDue >= bDue ? a : b;
}

function mergeStreak(
  a: ProgressDocument["streak"],
  b: ProgressDocument["streak"],
): ProgressDocument["streak"] {
  if (!a.lastDay) return { ...b };
  if (!b.lastDay) return { ...a };
  if (a.lastDay === b.lastDay) return { days: Math.max(a.days, b.days), lastDay: a.lastDay };
  return a.lastDay > b.lastDay ? { ...a } : { ...b };
}
