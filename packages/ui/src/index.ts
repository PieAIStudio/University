/**
 * The learning surface, as one import.
 *
 * Everything a shell needs to render a lesson lives behind this barrel: the
 * reader, the evidence rail, the review cards, the foreign-language layer and
 * the markdown pipeline that ties them together. A shell adds a way in and a
 * way out — a campus, or a world map — and owns nothing that is in here.
 */
export { LessonReader } from "./lesson/LessonReader.js";
export { LessonToolbar, lessonNeighbours, readProgress } from "./lesson/LessonNav.js";
export { MarkdownContent, isLocalUrl } from "./markdown/MarkdownContent.js";
export { ReviewCard } from "./review/ReviewCard.js";
export { ExerciseBlock } from "./review/ExerciseBlock.js";
export {
  ChoiceBlock,
  type ChoiceBlockExercise,
  type ChoiceBlockOption,
} from "./review/ChoiceBlock.js";
export { VocabularyReview } from "./review/VocabularyReview.js";
export { EvidenceRail } from "./evidence/EvidenceRail.js";
export { EvidenceCode } from "./evidence/EvidenceCode.js";
export { Tip } from "./Tip.js";
export {
  ReferencePanel,
  TermReferenceBody,
  type ReferenceKind,
} from "./reference/ReferencePanel.js";
export { TermIndex, LEXICON_SEARCH_PLACEHOLDER } from "./reference/TermIndex.js";
export * from "./view/lesson-view.js";
export * from "./api/client.js";
