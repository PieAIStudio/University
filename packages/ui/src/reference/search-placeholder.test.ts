import { describe, expect, it } from "vitest";

import { ANTI_PATTERN_SEARCH_PLACEHOLDER } from "./AntiPatternIndex.js";
import { CONCEPT_SEARCH_PLACEHOLDER } from "./ConceptIndex.js";
import { LEXICON_SEARCH_PLACEHOLDER } from "./TermIndex.js";
import { SEARCH_PLACEHOLDER_MAX_CHARS } from "./search-placeholder.js";

const PLACEHOLDERS = [
  ["概念图解", CONCEPT_SEARCH_PLACEHOLDER],
  ["词义索引", LEXICON_SEARCH_PLACEHOLDER],
  ["防 AI 味儿", ANTI_PATTERN_SEARCH_PLACEHOLDER],
] as const;

describe("search placeholders", () => {
  it.each(PLACEHOLDERS)("%s fits a 375px field", (_index, placeholder) => {
    expect(placeholder.length).toBeLessThanOrEqual(SEARCH_PLACEHOLDER_MAX_CHARS);
  });

  /*
    The budget only matters because the placeholder is teaching. A short one
    that shows no example spends nothing and says nothing.
  */
  it.each(PLACEHOLDERS)("%s still shows at least two examples", (_index, placeholder) => {
    expect(placeholder.match(/「/gu)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
