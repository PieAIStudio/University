/** Private lessons use unique native course identities, never public sample IDs. */
export const PERSONAL_STUDY_ID = "personal-learning";
export const PERSONAL_UNIT_ID = "my-task";
export const PERSONAL_LESSON_ID = "practice";
export const PERSONAL_CARD_ID = "personal-need-card";
export const PERSONAL_EXERCISE_ID = "personal-need-exercise";
export function personalCourseId(contentId: string): string {
  if (!/^[a-f0-9]{12}-[a-f0-9]{20}$/.test(contentId))
    throw new Error("Invalid personal content ID");
  return `task-${contentId}`;
}
export function personalContentId(courseId: string): string {
  const match = /^task-([a-f0-9]{12}-[a-f0-9]{20})$/.exec(courseId);
  if (!match) throw new Error("Invalid personal course ID");
  return match[1]!;
}
