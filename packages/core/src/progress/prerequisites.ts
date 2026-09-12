/**
 * 前置只灰，不锁 — V5 §12 决定 C.
 *
 * 「前置没满足的课显示为未点亮，并说明它假定你已经会了什么。但它仍然点得进去——
 * 点了先给一句『这节假定你已经做过 X，要不要先测一下』，然后由学习者决定。锁死会把
 * 有基础的人挡在门外，而那正是这一整条要解决的问题。灰是信息，锁是权力；这里我们只
 * 给信息。」
 *
 * So this module answers one question and deliberately does not answer another.
 * It says *which* courses a course assumes you have done and have not. It has
 * no `canEnter`, no `locked`, and nothing that returns a boolean an enter button
 * could be disabled by — because the moment such a function exists, disabling
 * the button is a one-line change somebody makes without reading this comment.
 *
 * The names come out, not the count. 「先修 2」 is a number a learner can read
 * and still not know what to do about; 「这门课假定你已经学过《在开始之前》」 is
 * the same fact in a form they can act on, which is the whole of 「灰是信息」.
 */

/** The shape both the map node and the shelf view already have. */
export interface PrerequisiteCandidate {
  readonly courseId: string;
  readonly title: string;
}

/**
 * The courses this one assumes, that the learner has not finished.
 *
 * Order follows `prerequisiteCourseIds` — the author's own order — rather than
 * the shelf's, because a course that lists two prerequisites usually lists the
 * one to do first, first.
 *
 * A prerequisite id matching nothing on the shelf is dropped rather than
 * reported. It is a content defect (`check-published-catalog` is where that
 * belongs), and naming an id at a learner would be worse than saying nothing.
 */
export function unmetPrerequisites(
  course: { readonly prerequisiteCourseIds?: readonly string[] },
  onTheShelf: readonly PrerequisiteCandidate[],
  isFinished: (courseId: string) => boolean,
): readonly PrerequisiteCandidate[] {
  const byId = new Map(onTheShelf.map((candidate) => [candidate.courseId, candidate]));
  const seen = new Set<string>();
  const unmet: PrerequisiteCandidate[] = [];
  for (const id of course.prerequisiteCourseIds ?? []) {
    if (seen.has(id) || isFinished(id)) continue;
    seen.add(id);
    const candidate = byId.get(id);
    if (candidate) unmet.push(candidate);
  }
  return unmet;
}

/**
 * Whether every prerequisite is finished — the map's lighting, and nothing else.
 *
 * Named for what it is used for. It used to be an inline `every(...)` inside the
 * scene's `stateOf`, which meant the map and any surface that wanted to say the
 * same thing in words were computing it separately from the same graph. Two
 * readings of one fact is how a course ends up lit on the map and described as
 * unmet on the card.
 */
export function prerequisitesMet(
  course: { readonly prerequisiteCourseIds?: readonly string[] },
  onTheShelf: readonly PrerequisiteCandidate[],
  isFinished: (courseId: string) => boolean,
): boolean {
  return unmetPrerequisites(course, onTheShelf, isFinished).length === 0;
}
