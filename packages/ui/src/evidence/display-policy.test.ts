import { describe, expect, it } from "vitest";

import type { RepositoryEvidenceView } from "../view/lesson-view.js";
import {
  citedEvidenceLineCount,
  INLINE_EVIDENCE_MAX_LINES,
  shouldInlineEvidence,
} from "./display-policy.js";

function repositoryEvidence(
  lineStart: number | null,
  lineEnd: number | null,
): RepositoryEvidenceView {
  return {
    kind: "repository",
    sourcePath: "src/app.ts",
    lineStart,
    lineEnd,
    sourceCommit: "a".repeat(40),
    nodeIds: [],
    note: null,
  };
}

describe("inline evidence display policy", () => {
  it("uses the cited range length and keeps the threshold boundary explicit", () => {
    expect(INLINE_EVIDENCE_MAX_LINES).toBe(16);
    expect(citedEvidenceLineCount(repositoryEvidence(4, 19))).toBe(16);
    expect(shouldInlineEvidence(repositoryEvidence(4, 19))).toBe(true);
    expect(shouldInlineEvidence(repositoryEvidence(4, 20))).toBe(false);
  });

  it("keeps whole-file and public-page citations out of the inline path", () => {
    expect(citedEvidenceLineCount(repositoryEvidence(null, null))).toBeNull();
    expect(shouldInlineEvidence(repositoryEvidence(null, null))).toBe(false);
    expect(
      shouldInlineEvidence({
        kind: "standard",
        sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/HTML",
        sourceTitle: "HTML",
        sourceAuthority: "MDN",
        note: null,
      }),
    ).toBe(false);
  });
});
