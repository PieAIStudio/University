/**
 * Where the review wisps come back (V7 decision O1): the finished lessons on a
 * course whose review cards are due now. The map shows "your island has
 * visitors" rather than "you have 3 cards due", and reviewing the cards sends
 * the wisp away — nothing here is stored; it is the scheduler's own due dates.
 */
import type { ProgressDocument } from "../ports/progress.js";

export function lessonsWithDueCards(
  document: ProgressDocument,
  course: { readonly studyId: string; readonly courseId: string },
  now: number,
): ReadonlySet<string> {
  const due = new Set<string>();
  for (const card of Object.values(document.cards))
    if (card.studyId === course.studyId && card.courseId === course.courseId && card.dueAt <= now)
      due.add(card.lessonId);
  return due;
}
