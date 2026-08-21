/**
 * What both shells have to agree on before either can render the other's world.
 *
 * The two shells store progress in places that will never be the same: the
 * authoring shell keeps rows in a per-study SQLite file on the author's own
 * machine, and the delivery shell keeps one object in a browser's
 * localStorage. That difference is fine and should stay. What is not fine is
 * that they had also, quietly, come to disagree about *what a lesson is* and
 * *what finished means* — and a shared 3D landing page cannot be built on top
 * of two answers to those questions.
 *
 * Measured before designing, because the two disagreements were the opposite
 * of what everyone assumed:
 *
 * | | delivery (`apps/online`) | authoring (`apps/local`) |
 * | --- | --- | --- |
 * | progress key | `studyId/courseId/lessonId` | `courseId/unitId/lessonId` |
 * | dropped | `unitId` | `studyId` — it selects the database file |
 * | finished | `progress >= 1`, written once | exercises all passed **and** a separate read-confirmation event |
 *
 * So each side is lossy, in a different direction, and one side's definition
 * of "finished" is strictly richer than the other's.
 *
 * This file is deliberately **a read model and not a storage migration**. It
 * does not tell either shell where to put its bytes. It says what a lesson is
 * called, what finished means, and what question a shared surface is allowed
 * to ask — which is all a shared surface actually needs, and is reversible in
 * a way that rewriting a learner's saved progress is not.
 */

/**
 * The four parts it takes to name one lesson anywhere in this product.
 *
 * All four, always. Both shells already carry all four in their URL layer, so
 * this is not new information anybody has to invent — it is the information
 * both of them already had and one of them threw away on the way to storage.
 *
 * Dropping `unitId`, as the delivery shell's key does, is safe only while no
 * course reuses a lesson id across two units. That holds today — 52 courses,
 * 560 lessons, zero collisions, checked rather than assumed — but nothing
 * enforces it, and the failure mode is silent: two lessons would share one
 * learner's progress and each would show the other's completion.
 */
export interface LessonRef {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

/**
 * The canonical name of a lesson.
 *
 * A store may key its own rows however it likes — this is what a *shared*
 * surface uses to talk about a lesson, and what two shells compare when they
 * need to agree they mean the same one.
 */
export function lessonRefKey(ref: LessonRef): string {
  return `${ref.studyId}/${ref.courseId}/${ref.unitId}/${ref.lessonId}`;
}

/** Parse a key back into a ref. Returns null rather than a half-built ref. */
export function parseLessonRefKey(key: string): LessonRef | null {
  const parts = key.split("/");
  if (parts.length !== 4) return null;
  const [studyId, courseId, unitId, lessonId] = parts;
  if (!studyId || !courseId || !unitId || !lessonId) return null;
  return { studyId, courseId, unitId, lessonId };
}

/**
 * Why a lesson counts as finished.
 *
 * Two independent conditions, and the authoring shell is the one that had this
 * right: answering every exercise is not the same as having read the lesson,
 * and a learner who skips to the quiz and guesses correctly has not done the
 * thing the product is for. Keeping them as separate facts also means a shell
 * that cannot observe one of them has to say so, rather than silently
 * reporting the other one twice.
 */
export interface LessonCompletion {
  /** Every gradable exercise in this lesson has a passing attempt. */
  readonly exercisesPassed: boolean;
  /** The learner confirmed they read it, rather than only answering. */
  readonly readConfirmed: boolean;
}

export const NOT_STARTED: LessonCompletion = {
  exercisesPassed: false,
  readConfirmed: false,
};

/** Both, or it is not finished. */
export function isLessonComplete(completion: LessonCompletion): boolean {
  return completion.exercisesPassed && completion.readConfirmed;
}

/**
 * The only question a shared surface may ask a shell about progress.
 *
 * Narrow on purpose. Everything a world map, an island or a settlement needs
 * is derivable from "is this lesson finished", and anything wider would let a
 * shared component depend on a storage detail that only one shell has.
 */
export interface ProgressSource {
  completionOf(ref: LessonRef): LessonCompletion;
}

/** The shape a course has to present to be placed in a world. */
export interface CourseShape {
  readonly studyId: string;
  readonly courseId: string;
  readonly units: readonly {
    readonly unitId: string;
    readonly lessonIds: readonly string[];
  }[];
}

/**
 * What a shared surface renders.
 *
 * `next` is the single lesson the world accents. One, never several: the world
 * says one sentence, and "here is where you were" stops being a sentence as
 * soon as it points at four places.
 */
export interface CourseProgress {
  readonly done: number;
  readonly total: number;
  readonly complete: boolean;
  readonly next: LessonRef | null;
}

/**
 * Fold a course and a shell's own progress into the read model.
 *
 * Order matters and is the course's own: `next` is the first unfinished lesson
 * in reading order, not the most recently touched. A learner who dips into
 * lesson 30 out of curiosity has not moved their place in the course.
 */
export function readCourseProgress(course: CourseShape, source: ProgressSource): CourseProgress {
  let done = 0;
  let total = 0;
  let next: LessonRef | null = null;
  for (const unit of course.units) {
    for (const lessonId of unit.lessonIds) {
      total += 1;
      const ref: LessonRef = {
        studyId: course.studyId,
        courseId: course.courseId,
        unitId: unit.unitId,
        lessonId,
      };
      if (isLessonComplete(source.completionOf(ref))) done += 1;
      else next ??= ref;
    }
  }
  return { done, total, complete: total > 0 && done === total, next };
}
