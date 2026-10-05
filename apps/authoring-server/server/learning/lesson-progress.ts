/**
 * What a lesson-progress row is allowed to say.
 *
 * Both the migration ladder and the running store enforce this, and they must
 * enforce exactly the same thing: a migration that accepted a row the store
 * would reject writes a database that fails to open. Keeping one copy is what
 * makes that guarantee hold — two copies only agree until someone edits one.
 */

export const LESSON_STATUS_ORDER = {
  "not-started": 0,
  "in-progress": 1,
  completed: 2,
} as const;

export function validateLessonProgress(status: string, progress: number): void {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new Error("Lesson progress must be between 0 and 1");
  }
  if (!(status in LESSON_STATUS_ORDER)) {
    throw new Error("Lesson status must be not-started, in-progress, or completed");
  }
  if (status === "not-started" && progress !== 0) {
    throw new Error("A not-started lesson must have zero progress");
  }
  if (status === "in-progress" && (progress <= 0 || progress >= 1)) {
    throw new Error("An in-progress lesson must have progress greater than zero and less than one");
  }
  if (status === "completed" && progress !== 1) {
    throw new Error("A completed lesson must have progress equal to one");
  }
}
