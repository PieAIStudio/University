// @vitest-environment jsdom
/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { MAP_CONTROLS_HINT, mapControlsHint } from "../camera/controls.js";

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

async function renderHint(node: ReactNode): Promise<{
  host: HTMLDivElement;
  unmount: () => Promise<void>;
}> {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<p className="hint">{node}</p>);
  });
  return {
    host,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe("MAP_CONTROLS_HINT", () => {
  it("keeps the three clauses and gives each a monochrome glyph, not an emoji", async () => {
    const { host, unmount } = await renderHint(MAP_CONTROLS_HINT);
    expect(host.textContent).toContain("拖动平移");
    expect(host.textContent).toContain("滚轮缩放");
    expect(host.textContent).toContain("点岛进入");
    expect(host.querySelectorAll(".hint__icon, .hint svg")).toHaveLength(3);
    expect(host.innerHTML).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    await unmount();
  });

  it("names zoom by pointer, so a phone is never told to use a wheel", async () => {
    const touch = await renderHint(mapControlsHint("touch"));
    expect(touch.host.textContent).toContain("拖动平移");
    expect(touch.host.textContent).toContain("双指缩放");
    expect(touch.host.textContent).toContain("点岛进入");
    expect(touch.host.textContent).not.toMatch(/滚轮|右键|鼠标/);
    expect(touch.host.querySelector(".hint__item--zoom-touch")).not.toBeNull();
    await touch.unmount();

    const mouse = await renderHint(mapControlsHint("mouse"));
    expect(mouse.host.textContent).toContain("滚轮缩放");
    expect(mouse.host.textContent).not.toMatch(/双指|捏合|右键/);
    expect(mouse.host.querySelector(".hint__item--zoom-mouse")).not.toBeNull();
    await mouse.unmount();
  });

  it("builds the zoom clause from a pointer, so a constant cannot lie about the device", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "map-controls-hint.tsx"),
      "utf8",
    );
    const fnStart = src.indexOf("export function mapControlsHint");
    const fnEnd = src.indexOf("function subscribeCoarsePointer");
    const fn = src.slice(fnStart, fnEnd);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fn).toMatch(/pointer === "touch"/);
    expect(fn).toMatch(/translate\("ui.world.mapControlsHint.copy.双指缩放"\)/);
    expect(fn).toMatch(/translate\("ui.world.mapControlsHint.copy.滚轮缩放"\)/);
    expect(fn).not.toMatch(/右键/);
    expect(src).not.toMatch(/export const MAP_CONTROLS_HINT: ReactNode = \(/);
    expect(src).not.toMatch(/export const MAP_CONTROLS_HINT[\s\S]{0,400}滚轮缩放/);
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
  it("sits at the horizontal centre, near the bottom, on the official glass HUD surface", () => {
    const hint = ruleBlock(CSS, ".hint");
    expect(hint).toMatch(/left:\s*50%/);
    expect(hint).toMatch(/translateX\(-50%\)/);
    expect(hint).toMatch(/bottom:/);
    expect(hint).toMatch(/background:\s*var\(--game-ui-panel\)/);
    expect(hint).toMatch(/color:\s*var\(--game-ui-text\)/);
    expect(hint).toMatch(/border:\s*1px solid var\(--game-ui-border-subtle\)/);
    expect(hint).not.toMatch(/left:\s*calc\(var\(--shell/);
  });

  it("tapers the shared map label budget at narrow breakpoints", () => {
    expect(CSS).toMatch(/--map-label-limit:\s*9;/);
    expect(CSS).toMatch(
      /@media \(max-width: 1023px\)[\s\S]*?--map-label-limit:\s*6;[\s\S]*?--map-label-gap:\s*6px;/,
    );
    expect(CSS).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?--map-label-limit:\s*4;[\s\S]*?--map-label-gap:\s*8px;/,
    );
    expect(CSS).toMatch(
      /@media \(max-width: 400px\)[\s\S]*?--map-label-limit:\s*3;[\s\S]*?--map-label-gap:\s*8px;/,
    );
  });
});
