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
export { AntiPatternIndex, ANTI_PATTERN_SEARCH_PLACEHOLDER } from "./reference/AntiPatternIndex.js";
export { ConceptIndex, CONCEPT_SEARCH_PLACEHOLDER } from "./reference/ConceptIndex.js";
export { CollectionIndex } from "./reference/CollectionIndex.js";
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
  FavouritesEmpty,
  FAVOURITES_EMPTY_ACTION,
  FAVOURITES_EMPTY_DESCRIPTION,
  FAVOURITES_EMPTY_TITLE,
  FAVOURITES_STORAGE_KEY,
  createLocalFavouritesStore,
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
  PRACTICE_RECENT_STORAGE_KEY,
  PRACTICE_UNLOCK_HINT,
  PracticeStream,
  PracticeRewardPanel,
  createLocalPracticeRecentStore,
  practiceOrdinalLabel,
  readLocalPracticeRecent,
  writeLocalPracticeRecent,
  type PracticeRecentStore,
} from "./practice/index.js";
export * from "./view/lesson-view.js";
export * from "./api/client.js";
