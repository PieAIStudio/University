import { describe, expect, it } from "vitest";

import { ANTI_PATTERN_ENTRIES } from "./catalog.js";
import { searchAntiPatterns } from "./search.js";

describe("anti-pattern search", () => {
  it("groups an empty query by category and counts each group", () => {
    const result = searchAntiPatterns(ANTI_PATTERN_ENTRIES, "  ");
    expect(result.query).toBe("");
    expect(result.total).toBe(25);
    expect(result.groups.map((group) => group.category)).toEqual([
      "verbal",
      "template",
      "interaction",
    ]);
    expect(result.groups.map((group) => group.count)).toEqual([11, 8, 6]);
  });

  it("matches a fragment that lives only in the complaint", () => {
    const result = searchAntiPatterns(ANTI_PATTERN_ENTRIES, "稳稳接住你");
    expect(result.total).toBe(1);
    expect(result.groups[0]?.entries[0]?.head.id).toBe("steady-catch");
  });

  it("matches a query that lives only in the section body", () => {
    const result = searchAntiPatterns(ANTI_PATTERN_ENTRIES, "点开图标就能用");
    expect(result.total).toBeGreaterThan(0);
    expect(
      result.groups.some((group) =>
        group.entries.some((entry) => entry.head.id === "inflated-metaphors"),
      ),
    ).toBe(true);
  });

  it("matches a category label so a chip name still finds the group", () => {
    const result = searchAntiPatterns(ANTI_PATTERN_ENTRIES, "页面模板感");
    const template = result.groups.find((group) => group.category === "template");
    expect(template?.count).toBe(8);
    expect(result.total).toBeGreaterThanOrEqual(8);
  });
});
