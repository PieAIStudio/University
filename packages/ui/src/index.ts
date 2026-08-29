/**
 * The learning surface, as one import.
 *
 * Everything a shell needs to render a lesson lives behind this barrel: the
 * reader, the evidence rail, the review cards, the foreign-language layer and
 * the markdown pipeline that ties them together. A shell adds a way in and a
 * way out — a campus, or a world map — and owns nothing that is in here.
 *
 * How to read this file:
 *
 * - Exports below are the **shared surface**. Both shells render these
 *   components; the delivery shell mostly comes through this barrel, the
 *   authoring shell mostly comes through deep paths of the same files.
 *   Changing a prop or a class name is a product change.
 * - `view/lesson-view` is the HTTP read-model the authoring campus talks in.
 *   The delivery shell currently takes one type from it (`LessonAssetView`).
 * - `api/client` is URL-building for the authoring shell's local API. The
 *   delivery shell does not use it.
 * - Deep paths exist because the authoring campus imports piece by piece.
 *   `package.json` `exports` lists the ones that are actually imported.
 *   CSS files travel the same way (`language/word-layer.css` and friends).
 *   Anything not listed there is internal assembly — do not import it
 *   from a shell.
 */

// Shared surface — the lesson itself. Both shells.
export { LessonReader } from "./lesson/LessonReader.js";
export type { LessonSourceVersionCheckout } from "./lesson/LessonSourceVersion.js";
export { CapabilityExplanation } from "./capability/CapabilityExplanation.js";
export { ReviewReminderPrompt } from "./notifications/ReviewReminderPrompt.js";
export { LayerCoverage } from "./evidence/LayerCoverage.js";
export { LessonToolbar, lessonNeighbours, readProgress } from "./lesson/LessonNav.js";
export { MarkdownContent, isLocalUrl } from "./markdown/MarkdownContent.js";
export { ReviewCard } from "./review/ReviewCard.js";
export { RecapPrompt } from "./review/RecapPrompt.js";
export { ExerciseBlock } from "./review/ExerciseBlock.js";
export {
  ChoiceBlock,
  type ChoiceBlockExercise,
  type ChoiceBlockOption,
} from "./review/ChoiceBlock.js";
export { VocabularyReview } from "./review/VocabularyReview.js";
export type { ReviewCardPort, VocabularyDueWord, VocabularyReviewPort } from "./review/ports.js";
// Where a lesson's text comes from, and the one review implementation both
// campuses share on top of it.
export type { CardBody, ContentPort, MistakeExercise } from "./content/port.js";
export {
  cardKeyOf,
  createReviewCardPort,
  createVocabularyReviewPort,
} from "./review/scheduler-ports.js";
export {
  TodaySection,
  reviewLine,
  todayMeta,
  type TodaySectionData,
} from "./today/TodaySection.js";
export { EvidenceRail } from "./evidence/EvidenceRail.js";
export { EvidenceCode } from "./evidence/EvidenceCode.js";
export { Tip } from "./Tip.js";
export {
  applyThemePreference,
  resolvedThemeOf,
  subscribeSystemTheme,
  SYSTEM_THEME_QUERY,
  systemPrefersDark,
  THEME_PREFERENCE_OPTIONS,
  watchThemePreference,
  type ResolvedTheme,
} from "./theme.js";

// Shared surface — reference collections and structured entries. The delivery
// shell imports these from this barrel; the authoring shell can, and must
// not grow a second copy.
export {
  ReferencePanel,
  TermReferenceBody,
  type ReferenceKind,
} from "./reference/ReferencePanel.js";
export { TermIndex, LEXICON_SEARCH_PLACEHOLDER } from "./reference/TermIndex.js";
export { AntiPatternIndex, ANTI_PATTERN_SEARCH_PLACEHOLDER } from "./reference/AntiPatternIndex.js";
export { ConceptIndex, CONCEPT_SEARCH_PLACEHOLDER } from "./reference/ConceptIndex.js";
export { CollectionIndex } from "./reference/CollectionIndex.js";
export { KnowledgeNotes } from "./reference/KnowledgeNotes.js";
export { LibrarySurface, REFERENCE_TABS, type ReferenceTab } from "./reference/LibrarySurface.js";
export { CourseRouteQuiz, classifyCourseRoute, hasRouteQuiz } from "./path/CourseRouteQuiz.js";
export {
  CatalogSurface,
  type CatalogCourse,
  type CatalogLesson,
  type CatalogListing,
  type CatalogStudy,
  type CatalogUnit,
} from "./catalog/CatalogSurface.js";
export {
  EntryPage,
  TermEntryHead,
  TermEntryPage,
  AntiPatternEntryHead,
  AntiPatternEntryPage,
  COLLECTION_LABEL,
  type EntryBreadcrumbItem,
  type EntryNeighbour,
  type EntryNeighbourPair,
  type EntryPageProps,
} from "./entry/EntryPage.js";
export { PronunciationButton } from "./entry/PronunciationButton.js";
export { EntryFloatNav } from "./entry/EntryFloatNav.js";
export {
  foldEntryMarkdown,
  registerSectionRenderer,
  getSectionRenderer,
  type SectionRenderer,
  type EntryRenderContext,
  type SenseTarget,
} from "./entry/section-registry.js";
export {
  DEFAULT_SECTION_RENDERERS,
  registerDefaultSectionRenderers,
} from "./entry/default-renderers.js";
export {
  FavouriteStar,
  FavouritesScreen,
  FavouritesEmpty,
  FAVOURITES_EMPTY_ACTION,
  FAVOURITES_EMPTY_DESCRIPTION,
  FAVOURITES_EMPTY_TITLE,
  FAVOURITES_STORAGE_KEY,
  createLocalFavouritesStore,
  createProgressFavouritesStore,
  favouriteStarLabel,
  readLocalFavourites,
  shouldPlayFavouriteSound,
  writeLocalFavourites,
  type FavouritesStore,
} from "./favourites/index.js";
export {
  PRACTICE_EMPTY_ACTION,
  PRACTICE_EMPTY_DESCRIPTION,
  PRACTICE_EMPTY_TITLE,
  PRACTICE_INTRO_ACTION,
  PRACTICE_INTRO_DESCRIPTION,
  PRACTICE_INTRO_TITLE,
  PRACTICE_RECENT_STORAGE_KEY,
  PRACTICE_UNLOCK_HINT,
  PracticeStream,
  PracticeOverview,
  PracticeSurface,
  PracticeRewardPanel,
  createLocalPracticeRecentStore,
  createProgressPracticeRecentStore,
  practiceSolvedLabel,
  sittingSolvedCount,
  readLocalPracticeRecent,
  writeLocalPracticeRecent,
  type PracticeRecentStore,
  type PracticeOverviewCategory,
  type PracticeOverviewProps,
} from "./practice/index.js";

// Shared surface — the path cards. DOM over the 3D path, never geometry.
export { NodeCard, unlockedConceptIds, type PathLesson } from "./path/NodeCard.js";
export { pathLessonOf, pathUnitOf } from "./path/from-course-view.js";
export { UnitCard, type PathUnit } from "./path/UnitCard.js";
export { CoursePickCard } from "./path/CoursePickCard.js";
export { coursePickStatsOf, type CoursePickStats } from "./path/course-pick-stats.js";

// Shared surface — screen 09. A concept while the canvas is still empty.
export {
  LoadingTrivia,
  pickLoadingConcept,
  useMapCover,
  MAP_COVER_GIVE_UP_MS,
  MAP_COVER_REOPEN_MS,
} from "./loading/LoadingTrivia.js";

// Authoring-shell read model: the shapes `/api/*` returns, and the pure
// functions that turn them into what the campus shows. Exporting the module
// whole is the point — this is one HTTP contract, not a grab bag. The
// delivery shell currently names `LessonAssetView` from here.
export * from "./view/lesson-view.js";

// Authoring-shell API contract: URL building and response unwrapping, no
// fetching. The whole module is that contract; the delivery shell does not
// talk to this API.
export * from "./api/client.js";
