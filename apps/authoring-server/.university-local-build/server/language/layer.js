import { composeLanguageLayer as compose, } from "@pieai/university-core/language/layer.js";
import { loadLexicon } from "./lexicon.js";
import { readLessonLanguageLayer } from "./overlay.js";
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
export function composeLanguageLayer(input) {
    const authored = readLessonLanguageLayer(input);
    return compose({
        content: input.content,
        lexicon: [...loadLexicon().values()],
        vocabulary: input.vocabulary,
        authored,
    });
}
//# sourceMappingURL=layer.js.map