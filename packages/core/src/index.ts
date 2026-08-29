/**
 * The shapes every part of this product agrees on.
 *
 * No React, no filesystem, no network — that is the whole point. A local server
 * writing JSON to disk and an online server writing rows to a database must
 * still be describing the same lesson, and this is where that sameness is
 * written down once.
 *
 * How to read this file:
 *
 * - Everything exported here is the **shared contract**. Both shells, the
 *   importer, and `packages/ui` may depend on it. Changing a name or a
 *   meaning is a product change, not a local tidy.
 * - **Authoring-shell only** lives on the schemas module and is *not*
 *   re-exported here: `UniversityLocalConfigSchema`, `AirlockSealSchema`,
 *   `UaAnalysisManifestSchema`, and their inferred types. Import those from
 *   `@pieai/university-core/domain/schemas.js`.
 * - A few modules are imported by deep path because the authoring server or
 *   the markdown pipeline wants one function, not this whole barrel. The
 *   only deep paths `package.json` still exposes are:
 *   `domain/schemas.js`, `domain/lesson-marks.js`, `domain/reader-marks.js`,
 *   `domain/merge-text-runs.js`, `marks/references.js`, `marks/path-stats.js`,
 *   `marks/terms.js`,
 *   `marks/evidence.js`, `language/layer.js`, `language/resolve-anchors.js`,
 *   `concepts/heads.js`.
 *   Anything else under `src/` is internal assembly.
 */

// Shared contract: on-disk content and learning records. Both shells parse
// the same JSON; the authoring shell is the writer, the delivery shell is
// the reader, and the importer compiles answers from these shapes.
export {
  StableId,
  Sha256,
  GitCommit,
  IsoDateTime,
  AuthoringFocusSchema,
  LearningFocusSchema,
  StudyManifestSchema,
  SourceRegistrationSchema,
  SenseId,
  LanguageAnchorSchema,
  LanguageOverlaySchema,
  LexiconEntrySchema,
  UaEngineProvenanceSchema,
  SnapshotManifestSchema,
  ContentStatus,
  EvidenceReferenceSchema,
  RepositoryEvidenceSchema,
  UrlEvidenceSchema,
  isRepositoryEvidence,
  isUrlEvidence,
  CourseCurrency,
  CourseManifestSchema,
  UnitManifestSchema,
  LessonVariantSchema,
  LessonSectionSchema,
  LessonAssetKindSchema,
  LessonAssetSchema,
  LessonManifestSchema,
  ChoiceOptionSchema,
  ChoiceExerciseSchema,
  ExerciseSchema,
  CardContentSchema,
  KnowledgeCardSchema,
  KnowledgeNoteSchema,
  type AuthoringFocus,
  type LearningFocus,
  type StudyManifest,
  type SourceRegistration,
  type LanguageAnchor,
  type LanguageOverlay,
  type LexiconEntry,
  type LexiconTrack,
  type SnapshotManifest,
  type UaEngineProvenance,
  type EvidenceReference,
  type RepositoryEvidence,
  type UrlEvidence,
  type CourseManifest,
  type CourseManifestInput,
  type UnitManifest,
  type LessonManifest,
  type LessonSection,
  type LessonAsset,
  type ChoiceOption,
  type ChoiceExercise,
  type Exercise,
  type CardContent,
  type KnowledgeClaim,
  type KnowledgeOrigin,
  type KnowledgeCard,
  type KnowledgeNote,
} from "./domain/schemas.js";
export {
  CHOICE_OPTION_COUNT,
  validateChoiceExercise,
  type ChoiceExerciseDraft,
  type ChoiceExerciseIssue,
  type ChoiceExerciseIssueCode,
  type ChoiceExerciseValidation,
} from "./domain/choice-exercise.js";

export { levelOf, totalXpForLevel, type Level } from "./progress/level.js";

// Structured entries: one collection system, head + typed sections. A section
// type that cannot serialise itself is a missing `sectionToMarkdown` branch,
// not a silent clipboard omission later. Consumers: both shells' reference
// pages and `packages/ui` entry rendering.
export {
  SECTION_TYPES,
  SECTION_HEADING,
  SECTION_PAYLOAD_SCHEMAS,
  FLOW_CAPTION,
  STYLE_SKIN_IDS,
  STYLE_SAMPLE_PAGE,
  STYLE_SKIN_LABELS,
  StyleSamplePayloadSchema,
  StyleSkinIdSchema,
  SectionTypeSchema,
  isEntrySectionType,
  parseEntrySection,
  parseEntrySections,
  sectionToMarkdown,
  sectionsToMarkdown,
  type DemoNode,
  type EntrySection,
  type EntrySectionType,
  type PayloadOf,
  type StyleSkinId,
  type ParsedEntrySections,
  type SectionProblem,
  type SectionProblemCode,
} from "./domain/entry-section.js";
export {
  COLLECTION_IDS,
  CollectionIdSchema,
  assembleStructuredEntry,
  assembleTermEntry,
  entryToMarkdown,
  termEntryToMarkdown,
  termHeadToMarkdown,
  type AssembledEntry,
  type CollectionId,
  type StructuredEntry,
  type TermEntry,
} from "./domain/structured-entry.js";
export {
  ANTI_PATTERN_CATEGORY_IDS,
  ANTI_PATTERN_CATEGORY_LABEL,
  ANTI_PATTERN_NOTICE,
  ANTI_PATTERN_NOTICE_HEADING,
  AntiPatternCategorySchema,
  AntiPatternHeadSchema,
  antiPatternEntryToMarkdown,
  antiPatternHeadToMarkdown,
  assembleAntiPatternEntry,
  loadAntiPattern,
  type AntiPatternBody,
  type AntiPatternCategory,
  type AntiPatternEntry,
  type AntiPatternHead,
} from "./domain/anti-pattern.js";
export {
  ANTI_PATTERN_CHIP_ORDER,
  ANTI_PATTERN_COUNTS,
  ANTI_PATTERN_ENTRIES,
  antiPatternsInCategory,
  getAntiPatternEntry,
} from "./anti-patterns/catalog.js";
export {
  createAntiPatternIndex,
  searchAntiPatternIndex,
  searchAntiPatterns,
  type AntiPatternSearchIndex,
  type AntiPatternSearchGroup,
  type AntiPatternSearchResult,
} from "./anti-patterns/search.js";

// The third collection on the same entry system: 281 illustrated concepts in
// seven categories. A third page component would be SPEC-0004 failing, so what
// is new here is a head adapter and a catalogue, nothing else.
export {
  CONCEPT_CATEGORY_IDS,
  CONCEPT_CATEGORY_LABEL,
  ConceptCategorySchema,
  ConceptHeadSchema,
  assembleConceptEntry,
  conceptEntryToMarkdown,
  conceptHeadToMarkdown,
  loadConcept,
  type ConceptBody,
  type ConceptCategory,
  type ConceptEntry,
  type ConceptHead,
  type ConceptLoadProblem,
  type RawConcept,
} from "./domain/concept.js";
export {
  CONCEPT_CHIP_ORDER,
  CONCEPT_COUNTS,
  CONCEPT_ENTRIES,
  CONCEPT_PROBLEMS,
  conceptGroupsIn,
  conceptNeighbours,
  conceptsInCategory,
  getConceptEntry,
} from "./concepts/catalogue.js";
export { CONCEPT_HEADS } from "./concepts/heads.js";
export {
  createConceptIndex,
  searchConceptIndex,
  searchConcepts,
  type ConceptSearchIndex,
  type ConceptSearchGroup,
  type ConceptSearchResult,
} from "./concepts/search.js";

// One scheduler, so both shells answer "what is due tomorrow" the same way.
// The whole module is the contract: parameters, review, and the JSON card
// shape a store that cannot hold a Date has to persist.
export * from "./scheduling/fsrs.js";

// Tier-one grading: fingerprint the answer at import time, compare without
// shipping it. The whole module is that contract.
export * from "./grading/answer-key.js";

// The foreign-language layer: which words a learner sees annotated, and why.
// Pure, so the delivery shell can compute it in the browser from the same rule
// the authoring shell runs on the server. The whole composer is the contract;
// detect/resolve are the pieces a caller may want without composing.
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

// Who is signed in, and where their progress lives. Ports are types plus the
// one in-process implementation; network and filesystem stay in the shells.
export * from "./ports/index.js";

// The one thing both shells must agree on before either can render the other's
// world: what a lesson is called, and what finished means. A read model, not a
// storage migration — neither store is told where to put its bytes. The whole
// module is that question.
export * from "./progress/contract.js";
export * from "./progress/depth.js";

// Recommended learning sequence (spine order) per study — a linear extension
// of the prerequisite DAG so there is always exactly one "next step".
export * from "./progress/spine.js";
export * from "./progress/xp.js";
export * from "./progress/goals.js";
export * from "./billing/plans.js";
export * from "./billing/entitlements.js";

// The learner's progress document, the merge that keeps two machines honest,
// and the one port both shells construct. Persistence and remote are injected.
export {
  PROGRESS_STORAGE_KEY,
  cloneProgress,
  createMemoryPersistence,
  createMemoryRemoteStore,
  createProgressPort,
  progressSourceOf,
  emptyProgress,
  lessonKey,
  lessonKeyOf,
  recapCardKeyOf,
  RECAP_CARD_ID,
  type LessonDocumentKey,
  mergeProgress,
  parseProgress,
} from "./progress/index.js";
export { mistakesOf, type Mistake } from "./progress/mistakes.js";

// Favourites are a versioned document of sense ids. Pure: storage is an
// adapter, so the account-backed store is a different reader/writer rather
// than a second model. The whole document algebra is the contract.
export * from "./favourites/model.js";

// Practice is an entry's own three-option quiz, served as an endless sitting.
// Identity is `${category}-${id}`; storage of the recent-id ring is an
// adapter, same split as favourites.
export {
  EMPTY_PRACTICE_RECENT,
  PRACTICE_RECENT_DOCUMENT_VERSION,
  PRACTICE_RECENT_LIMIT,
  advancePracticeSession,
  assemblePracticeQuestion,
  idOfPracticeQuestion,
  indexPracticeQuestions,
  parsePracticeRecent,
  pickPracticeQuestionId,
  practiceQuestionIdFromSubject,
  rememberPracticeQuestion,
  startPracticeSession,
  unlockPracticeSession,
  type PracticeAssembly,
  type PracticeExercise,
  type PracticeIssue,
  type PracticeIssueCode,
  type PracticeQuestion,
  type PracticeRecentState,
  type PracticeSession,
  type PracticeSubject,
} from "./practice/index.js";

// One address space, both campuses. `View` names every destination the product
// has; `toPath`/`fromPath` are the only two functions allowed to know what a
// canonical URL looks like. `toHash`/`fromHash` remain compatibility adapters
// for bookmarks written before the path migration.
export {
  activeIdForView,
  fromHash,
  fromPath,
  isBareView,
  isSafeId,
  libraryTabOf,
  LIBRARY_TABS,
  LIBRARY_VIEW_TAB,
  studyIdOfView,
  toHash,
  toPath,
  WORLD,
  type LibraryTab,
  type View,
} from "./routing/view.js";
