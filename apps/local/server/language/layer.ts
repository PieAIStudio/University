import {
  composeLanguageLayer as compose,
  type ComposedLanguageLayer,
} from "@pieai/university-core/language/layer.js";

import { loadLexicon } from "./lexicon.js";
import { readLessonLanguageLayer, type LanguageCode } from "./overlay.js";
import type { VocabularyState } from "./vocabulary-store.js";

/**
 * Reads this shell's two disk-backed inputs and hands them to the shared
 * composer.
 *
 * The rule for which words a learner sees lives in
 * `@pieai/university-core/language/layer.js`, because the delivery shell needs
 * the same rule and has no disk to read from. What stays here is the part that
 * is genuinely local: an overlay stored under `studies/`, and a lexicon file
 * resolved against this package.
 */
export function composeLanguageLayer(input: {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly language: LanguageCode;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly contentRevision: number;
  readonly content: string;
  readonly vocabulary: readonly VocabularyState[];
}): ComposedLanguageLayer {
  const authored = readLessonLanguageLayer(input);
  return compose({
    content: input.content,
    lexicon: [...loadLexicon().values()],
    vocabulary: input.vocabulary,
    authored,
  });
}
