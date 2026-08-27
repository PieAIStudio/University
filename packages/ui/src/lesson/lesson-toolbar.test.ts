/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./lesson-toolbar.css", import.meta.url), "utf8");
const phoneRule = css.slice(css.indexOf("@media (max-width: 640px)"));

describe("lesson toolbar phone layout", () => {
  it("constrains the tools row so wrapped controls stay inside the viewport", () => {
    expect(phoneRule).toContain(".lesson-toolbar__tools");
    expect(phoneRule).toMatch(/flex:\s*1 1 100%/);
    expect(phoneRule).toMatch(/width:\s*100%/);
    expect(phoneRule).toMatch(/justify-content:\s*flex-start/);
    expect(phoneRule).toMatch(/\.lesson-toolbar__tools \.sound-toggle[\s\S]*min-width:\s*44px/);
    expect(phoneRule).toMatch(/\.lesson-toolbar__tools \.sound-toggle[\s\S]*min-height:\s*44px/);
  });
});
