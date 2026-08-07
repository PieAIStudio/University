import { describe, expect, it } from "vitest";

import { resolveEvidenceAnchors, type EvidenceCitation } from "./evidence-anchors.js";

const CITED: readonly EvidenceCitation[] = [
  { sourcePath: "index.html", lineStart: 29, lineEnd: 31 },
  { sourcePath: "src/main.tsx", lineStart: 32, lineEnd: 32 },
  { sourcePath: "README.md", lineStart: null, lineEnd: null },
];

function anchors(content: string) {
  return resolveEvidenceAnchors(content, CITED);
}

describe("inline evidence anchors", () => {
  it("resolves a single line inside a cited range", () => {
    const [found] = anchors("那一行是空的 [[evidence:index.html:30]]。");

    expect(found).toMatchObject({
      sourcePath: "index.html",
      lineStart: 30,
      lineEnd: 30,
      resolved: true,
    });
  });

  it("resolves a range exactly equal to the citation", () => {
    expect(anchors("[[evidence:index.html:29-31]]")[0]).toMatchObject({
      lineStart: 29,
      lineEnd: 31,
      resolved: true,
    });
  });

  it("refuses a range that reaches past what the lesson cites", () => {
    // The citation is pinned to an immutable snapshot. Letting prose name lines
    // nobody verified would make the evidence rail a decoration.
    expect(anchors("[[evidence:index.html:29-40]]")[0]?.resolved).toBe(false);
    expect(anchors("[[evidence:index.html:1]]")[0]?.resolved).toBe(false);
  });

  it("refuses a file the lesson does not cite at all", () => {
    expect(anchors("[[evidence:src/other.ts:1]]")[0]?.resolved).toBe(false);
  });

  it("treats a whole-file citation as covering any line in it", () => {
    expect(anchors("[[evidence:README.md:1-4]]")[0]?.resolved).toBe(true);
    expect(anchors("[[evidence:README.md:900]]")[0]?.resolved).toBe(true);
  });

  it("reports malformed targets rather than throwing", () => {
    for (const token of [
      "[[evidence:index.html]]",
      "[[evidence:index.html:]]",
      "[[evidence:index.html:abc]]",
      "[[evidence::30]]",
      "[[evidence:index.html:0]]",
      "[[evidence:index.html:31-29]]",
    ]) {
      const [found] = anchors(token);
      expect(found?.resolved).toBe(false);
    }
  });

  it("ignores lesson links, and lesson-link resolution ignores these", () => {
    expect(anchors("[[lesson:other]] 和 [[evidence:index.html:30]]")).toHaveLength(1);
  });

  it("leaves anchors inside code fences alone", () => {
    const content = ["写法是：", "", "```md", "[[evidence:index.html:30]]", "```", ""].join("\n");

    expect(anchors(content)).toHaveLength(0);
  });

  it("reports ranges that index the original bytes", () => {
    const content = "开头 [[evidence:index.html:30]] 结尾";
    const [found] = anchors(content);

    expect(content.slice(found!.start, found!.end)).toBe("[[evidence:index.html:30]]");
  });
});
