import type { TermRange } from "../domain/lesson-marks.js";
import type { LexiconEntry } from "../domain/schemas.js";
import { tokenKind, type ParsedLessonLink } from "./references.js";

export type { TermRange } from "../domain/lesson-marks.js";

/**
 * Authored pointers at a sense in the lexicon: `[[term:app.program]]` or
 * `[[term:app.program|应用]]`.
 *
 * The language layer already underlines words it detects. This is the other
 * direction — the author naming a sense on purpose, the way they name a lesson
 * or a line of evidence. Detection can miss; an authored token cannot pretend
 * the word was never meant.
 *
 * A sense that is not in the lexicon is reported, never thrown: the same
 * contract as a lesson link that does not resolve. The page stays up, and the
 * caller decides how loud to be.
 */

export type TermResolution =
  | {
      readonly kind: "resolved";
      readonly link: ParsedLessonLink;
      readonly senseId: string;
      readonly entry: LexiconEntry;
    }
  | {
      readonly kind: "broken";
      readonly link: ParsedLessonLink;
      readonly senseId: string;
      readonly reason: "not-found" | "malformed";
    };

/**
 * Resolves `term:` tokens against a lexicon.
 *
 * Never throws. An empty sense id is malformed; a well-formed id that is not
 * in the lexicon is not-found. Either way the caller gets data, not an
 * exception that takes the lesson down with it.
 */
export function resolveTermLinks(
  links: readonly ParsedLessonLink[],
  lexicon: ReadonlyMap<string, LexiconEntry>,
): readonly TermResolution[] {
  return links
    .filter((link) => tokenKind(link) === "term")
    .map((link): TermResolution => {
      const [kind, ...rest] = link.rawTarget.split(":");
      const senseId = rest.join(":").trim();
      if (kind !== "term" || senseId === "") {
        return { kind: "broken", link, senseId, reason: "malformed" };
      }
      const entry = lexicon.get(senseId);
      if (!entry) return { kind: "broken", link, senseId, reason: "not-found" };
      return { kind: "resolved", link, senseId, entry };
    });
}

/** Wire shape the reader renders. `entry` is null when the sense is missing. */
export function termRangeOf(item: TermResolution): TermRange {
  return {
    start: item.link.start,
    end: item.link.end,
    senseId: item.senseId,
    label: item.link.label,
    entry: item.kind === "resolved" ? item.entry : null,
  };
}
