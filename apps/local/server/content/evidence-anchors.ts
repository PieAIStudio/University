import type { EvidenceAnchorRange } from "@pieai/university-core/domain/lesson-marks.js";
import { parseLessonLinks, tokenKind, type ParsedLessonLink } from "./lesson-links.js";

export type { EvidenceAnchorRange } from "@pieai/university-core/domain/lesson-marks.js";

/**
 * Inline "where does this come from" markers, standing next to the claim.
 *
 * The sidebar already lists a lesson's evidence, and that answers "what is this
 * lesson based on". It does not answer "which line is *this paragraph* talking
 * about" — and a reader who wants to open the file at the sentence they are
 * reading should not have to go match a path by eye in a rail.
 *
 * Syntax: `[[evidence:index.html:30]]` or `[[evidence:index.html:29-31]]`.
 *
 * An anchor must point inside a range the lesson manifest already cites. That
 * is the point rather than a limitation: the manifest's evidence is pinned to
 * an immutable snapshot commit, so an anchor that could name any line would let
 * prose cite something nobody verified.
 */

export interface EvidenceCitation {
  readonly sourcePath: string;
  /** Absent or null both mean "the whole file", which the manifest allows. */
  readonly lineStart?: number | null | undefined;
  readonly lineEnd?: number | null | undefined;
}

/** `path:line` or `path:start-end`. The path may itself contain colons on Windows-ish input. */
function parseTarget(
  rawTarget: string,
): { readonly sourcePath: string; readonly lineStart: number; readonly lineEnd: number } | null {
  const withoutKind = rawTarget.slice("evidence:".length);
  const lastColon = withoutKind.lastIndexOf(":");
  if (lastColon <= 0) return null;
  const sourcePath = withoutKind.slice(0, lastColon).trim();
  const lines = withoutKind.slice(lastColon + 1).trim();
  const match = /^(\d+)(?:-(\d+))?$/.exec(lines);
  if (!sourcePath || !match) return null;
  const lineStart = Number(match[1]);
  const lineEnd = match[2] === undefined ? lineStart : Number(match[2]);
  if (lineStart < 1 || lineEnd < lineStart) return null;
  return { sourcePath, lineStart, lineEnd };
}

function isCovered(
  citations: readonly EvidenceCitation[],
  target: { readonly sourcePath: string; readonly lineStart: number; readonly lineEnd: number },
): number | null {
  const index = citations.findIndex((citation) => {
    if (citation.sourcePath !== target.sourcePath) return false;
    // A whole-file citation carries no lines and covers anything in that file.
    if (citation.lineStart == null || citation.lineEnd == null) return true;
    return target.lineStart >= citation.lineStart && target.lineEnd <= citation.lineEnd;
  });
  return index === -1 ? null : index;
}

/**
 * Resolves the evidence anchors in one lesson's prose.
 *
 * Pure, and takes the citations rather than reading the manifest, so the rule
 * "an anchor may only name lines the lesson already cites" is testable without
 * a study on disk.
 */
export function resolveEvidenceAnchors(
  content: string,
  citations: readonly EvidenceCitation[],
): readonly EvidenceAnchorRange[] {
  return parseLessonLinks(content)
    .filter((link: ParsedLessonLink) => tokenKind(link) === "evidence")
    .map((link): EvidenceAnchorRange => {
      const target = parseTarget(link.rawTarget);
      if (!target) {
        return {
          start: link.start,
          end: link.end,
          sourcePath: link.rawTarget.slice("evidence:".length),
          lineStart: 0,
          lineEnd: 0,
          resolved: false,
          evidenceIndex: null,
        };
      }
      const evidenceIndex = isCovered(citations, target);
      return {
        start: link.start,
        end: link.end,
        ...target,
        resolved: evidenceIndex !== null,
        evidenceIndex,
      };
    });
}
