/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "lesson-toolbar.css"),
  "utf8",
);
const phoneRule = css.slice(css.indexOf("@media (max-width: 640px)"));

describe("lesson toolbar phone layout", () => {
  it("allows long localized tools to wrap without hiding controls or an orphaned label", () => {
    expect(phoneRule).toContain(".lesson-toolbar__tools");
    expect(phoneRule).toMatch(/flex:\s*1 1 100%/);
    expect(phoneRule).toMatch(/width:\s*100%/);
    expect(phoneRule).toMatch(/justify-content:\s*flex-start/);
    expect(phoneRule).toMatch(/flex-wrap:\s*wrap/);
    expect(phoneRule).toMatch(/\.lesson-toolbar__label[\s\S]*display:\s*none/);
    expect(phoneRule).toMatch(
      /\.lesson-toolbar__tools \.game-ui-segmented-option[\s\S]*white-space:\s*nowrap/,
    );
    expect(phoneRule).toMatch(/\.lesson-toolbar__tools \.sound-toggle[\s\S]*min-width:\s*44px/);
    expect(phoneRule).toMatch(/\.lesson-toolbar__tools \.sound-toggle[\s\S]*min-height:\s*44px/);
  });
});
