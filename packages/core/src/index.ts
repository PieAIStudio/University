/**
 * The shapes every part of this product agrees on.
 *
 * No React, no filesystem, no network — that is the whole point. A local server
 * writing JSON to disk and an online server writing rows to a database must
 * still be describing the same lesson, and this is where that sameness is
 * written down once.
 */
export * from "./domain/schemas.js";
export {
  CHOICE_OPTION_COUNT,
  validateChoiceExercise,
  type ChoiceExerciseDraft,
  type ChoiceExerciseIssue,
  type ChoiceExerciseIssueCode,
  type ChoiceExerciseValidation,
} from "./domain/choice-exercise.js";

export * from "./scheduling/fsrs.js";
export * from "./grading/answer-key.js";

// The foreign-language layer: which words a learner sees annotated, and why.
// Pure, so the delivery shell can compute it in the browser from the same rule
// the authoring shell runs on the server.
export * from "./language/layer.js";
export { detectAnchors, adaptiveTargetCount } from "./language/detect.js";
export {
  resolveAnchors,
  findProtectedRegions,
  segmentContent,
} from "./language/resolve-anchors.js";

// Wiki tokens (`[[kind:target]]`). Parsing and resolution are pure; the
// authoring shell is the one that builds an index by reading lessons off disk.
export {
  parseLessonLinks,
  tokenKind,
  resolveLessonLinks,
  backlinksOf,
  assembleLessonIndex,
  type ParsedLessonLink,
  type LinkResolution,
  type LessonIndex,
  type LessonIndexEntry,
  type LessonIndexSource,
} from "./marks/references.js";
export { resolveEvidenceAnchors, type EvidenceCitation } from "./marks/evidence.js";
export { resolveTermLinks, termRangeOf, type TermResolution } from "./marks/terms.js";

// Term index. The searchable projection of a lexicon: headword, gloss, usage,
// and the optional colloquial sentence a beginner would actually say.
export {
  createLexiconIndex,
  searchLexicon,
  searchLexiconIndex,
  type LexiconIndex,
  type LexiconSearchGroup,
  type LexiconSearchResult,
} from "./lexicon/search.js";

// The one thing both shells must agree on before either can render the other's
// world: what a lesson is called, and what finished means. A read model, not a
// storage migration — neither store is told where to put its bytes.
export * from "./progress/contract.js";
