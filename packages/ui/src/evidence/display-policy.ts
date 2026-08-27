import type { EvidenceView, RepositoryEvidenceView } from "../view/lesson-view.js";
import { isUrlEvidenceView } from "../view/lesson-view.js";

/**
 * A short source citation should be visible while the sentence that uses it is
 * still in view. The 2026-08-27 shelf audit found 1,597 repository ranges: the
 * median is 9 lines and P75 is 17, so 16 is the last count before the longest
 * quarter. At 17 lines the code block starts changing the reading rhythm; a
 * longer range stays behind the existing chip and source panel.
 *
 * This counts the cited range only. `loadEvidenceSnippet` may add its existing
 * bounded context around that range, but the citation itself remains the
 * decision boundary.
 */
export const INLINE_EVIDENCE_MAX_LINES = 16;

export function citedEvidenceLineCount(reference: RepositoryEvidenceView): number | null {
  if (reference.lineStart === null || reference.lineEnd === null) return null;
  return reference.lineEnd - reference.lineStart + 1;
}

export function shouldInlineEvidence(reference: EvidenceView): boolean {
  if (isUrlEvidenceView(reference)) return false;
  const lineCount = citedEvidenceLineCount(reference);
  return lineCount !== null && lineCount <= INLINE_EVIDENCE_MAX_LINES;
}
