import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadLexicon } from "./lexicon.js";

describe("loadLexicon", () => {
  it("treats a configured course root without vocabulary as an empty layer", () => {
    const root = mkdtempSync(join(tmpdir(), "university-local-empty-lexicon-"));
    mkdirSync(join(root, "vocabulary"));

    expect(loadLexicon(join(root, "vocabulary/en.json"))).toEqual(new Map());
  });
});
