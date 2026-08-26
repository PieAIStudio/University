export {
  isLessonComplete,
  lessonRefKey,
  NOT_STARTED,
  parseLessonRefKey,
  readCourseProgress,
  courseShapeOf,
  type CourseProgress,
  type CourseLessonShape,
  type CourseShape,
  type LessonCompletion,
  type LessonProgressSnapshot,
  type LessonRef,
  type ProgressSource,
} from "./contract.js";

export { nextCourseAfter, spineOf, validateSpine, type SpineEntry } from "./spine.js";

export {
  cloneProgress,
  emptyProgress,
  lessonKey,
  lessonKeyOf,
  recapCardKeyOf,
  RECAP_CARD_ID,
  type LessonDocumentKey,
  parseProgress,
  PROGRESS_STORAGE_KEY,
} from "./document.js";
export { mergeProgress } from "./merge.js";
export { levelOf, totalXpForLevel, type Level } from "./level.js";
export { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";
export { createProgressPort } from "./port.js";
export { progressSourceOf } from "./source.js";
export { mistakesOf, type Mistake } from "./mistakes.js";
