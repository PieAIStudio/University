import { describe, expect, it } from "vitest";

import { evidenceCount, evidenceLocatorsIn, unlockEntryCount } from "./path-stats.js";

describe("shelf facts derived from lesson prose", () => {
  it("keeps raw counts and parsed evidence coordinates on their existing paths", () => {
    const content = [
      "正文 [[evidence:src/app.ts:1-2]] [[evidence:src/app.ts:1-2]]",
      "[[term:app.program]] [[concept:browser]]",
      "```md",
      "[[evidence:example.ts:3-4]]",
      "```",
    ].join("\n");

    expect(evidenceCount(content)).toBe(3);
    expect(unlockEntryCount(content)).toBe(2);
    expect(evidenceLocatorsIn(content)).toEqual(["src/app.ts:1-2"]);
  });
});
