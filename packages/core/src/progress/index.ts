export {
  isLessonComplete,
  lessonRefKey,
  NOT_STARTED,
  parseLessonRefKey,
  readCourseProgress,
  courseShapeOf,
  type CourseProgress,
  type CourseShape,
  type LessonCompletion,
  type LessonRef,
  type ProgressSource,
} from "./contract.js";

export { nextCourseAfter, spineOf, validateSpine, type SpineEntry } from "./spine.js";

export {
  cloneProgress,
  emptyProgress,
  lessonKey,
  lessonKeyOf,
  type LessonDocumentKey,
  parseProgress,
  PROGRESS_STORAGE_KEY,
} from "./document.js";
export { mergeProgress } from "./merge.js";
export { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";
export { createProgressPort } from "./port.js";
