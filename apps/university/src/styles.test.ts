import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const shellCss = readFileSync(
  new URL("../../../packages/ui/src/shell/app-shell.css", import.meta.url),
  "utf8",
);
const baseLearnStage = /\.learn-stage\s*\{([\s\S]*?)\n\}/.exec(styles)?.[1] ?? "";
const desktopLearnStage =
  /@media \(min-width: 768px\)\s*\{\s*\.learn-stage\s*\{([\s\S]*?)\n\s*\}\s*\}/.exec(styles)?.[1] ??
  "";

const declarations = (block: string, property: string) =>
  [...block.matchAll(new RegExp(`^\\s*${property}:\\s*([^;]+);`, "gm"))].map(([, value]) => value);

describe("page pinch policy", () => {
  it("filters pinch-zoom in CSS without locking the viewport scale", () => {
    expect(styles).toMatch(/touch-action:\s*pan-x pan-y/);
    expect(styles).not.toMatch(/touch-action:\s*none/);
    expect(indexHtml).toMatch(/name="viewport"/);
    expect(indexHtml).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(indexHtml).not.toMatch(/maximum-scale\s*=\s*1/i);
  });

  it("keeps a phone aside row when the shell marks the picker as the way forward", () => {
    expect(shellCss).toMatch(/data-aside-phone="true"/);
    expect(shellCss).toMatch(/max-width:\s*767px/);
    expect(shellCss).toMatch(
      /\.app-shell\[data-aside-phone="true"\] \.app-shell__aside\s*\{[^}]*display:\s*block/s,
    );
  });
});

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
