/**
 * The foreign-language layer, computed in the browser.
 *
 * The authoring shell composes this on a server with a database behind it. This
 * shell has neither, and for a long time that was read as "the online product
 * cannot have the feature" — the belief being that annotations were hand-made
 * upstream and would have to be exported before anything could render.
 *
 * They are not, or not only. A hand-authored overlay is one of two sources, and
 * the other one — detecting lexicon headwords in the prose — needs nothing but
 * the prose and the word list. Both are here. So the rule that decides which
 * words a learner sees lives in `@pieai/university-core` and runs identically
 * in both shells, and the 90 KB word list ships in this bundle.
 *
 * What this shell does not have is the curated overlay, which upstream stores
 * outside the export format. Its absence costs precision on a few dozen
 * lessons, not the feature.
 */
import { composeLanguageLayer, type LexiconEntry } from "@pieai/university-core";
import type { LanguageLayer } from "@pieai/university-core/domain/lesson-marks.js";

import lexiconFile from "../content/lexicon.json";
import { vocabularyStates } from "../progress/store";

export const LEXICON = lexiconFile.entries as readonly LexiconEntry[];

/**
 * Builds the layer for one lesson's prose.
 *
 * `lexicon` carries only the senses this lesson actually annotates: the reader
 * looks entries up by id, and handing it all 267 would ship a dictionary to
 * render two words.
 */
export function languageLayerFor(prose: string): LanguageLayer {
  const composed = composeLanguageLayer({
    content: prose,
    lexicon: LEXICON,
    vocabulary: vocabularyStates(),
  });
  const used = new Set(composed.senseIds);
  return {
    status: composed.status,
    ranges: composed.ranges,
    lexicon: LEXICON.filter((entry) => used.has(entry.senseId)),
    reasons: composed.reasons,
  };
}
