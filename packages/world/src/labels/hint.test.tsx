// @vitest-environment jsdom
/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { MAP_CONTROLS_HINT } from "../camera/controls.js";

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../overlay.css"), "utf8");

function ruleBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${selector}`);
}

describe("MAP_CONTROLS_HINT", () => {
  it("keeps the three clauses and gives each a monochrome glyph, not an emoji", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<p className="hint">{MAP_CONTROLS_HINT}</p>);
    });
    expect(host.textContent).toContain("拖动平移");
    expect(host.textContent).toContain("滚轮缩放");
    expect(host.textContent).toContain("点岛进入");
    expect(host.querySelectorAll(".hint__icon, .hint svg")).toHaveLength(3);
    expect(host.innerHTML).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});

describe("overlay.css .picked--follow", () => {
  it("is placed by transform, not pinned to a screen corner", () => {
    const follow = ruleBlock(CSS, ".picked.picked--follow");
    expect(follow).toMatch(/position:\s*absolute/);
    expect(follow).toMatch(/left:\s*0/);
    expect(follow).toMatch(/top:\s*0/);
    expect(follow).toMatch(/right:\s*auto/);
    expect(follow).not.toMatch(/right:\s*calc/);
    expect(follow).toMatch(/opacity:\s*var\(--placed/);
  });
});

describe("overlay.css .hint", () => {
  it("sits at the horizontal centre, near the bottom, with a transparent ground", () => {
    const hint = ruleBlock(CSS, ".hint");
    expect(hint).toMatch(/left:\s*50%/);
    expect(hint).toMatch(/translateX\(-50%\)/);
    expect(hint).toMatch(/bottom:/);
    expect(hint).toMatch(/background:\s*transparent/);
    expect(hint).not.toMatch(/left:\s*calc\(var\(--shell/);
  });
});
