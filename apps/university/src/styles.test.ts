import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const baseLearnStage = /\.learn-stage\s*\{([\s\S]*?)\n\}/.exec(styles)?.[1] ?? "";
const desktopLearnStage =
  /@media \(min-width: 768px\)\s*\{\s*\.learn-stage\s*\{([\s\S]*?)\n\s*\}\s*\}/.exec(styles)?.[1] ??
  "";

const declarations = (block: string, property: string) =>
  [...block.matchAll(new RegExp(`^\\s*${property}:\\s*([^;]+);`, "gm"))].map(([, value]) => value);

describe("the learner stage sizing contract", () => {
  it("keeps a definite mobile height and matching minimum", () => {
    const heights = declarations(baseLearnStage, "height");
    const minHeights = declarations(baseLearnStage, "min-height");

    expect(heights).toEqual(["min(70dvh, 720px)"]);
    expect(minHeights).toEqual(heights);
    expect(heights).not.toContain("100%");
    expect(declarations(desktopLearnStage, "height")).toEqual(["100%"]);
  });
});
