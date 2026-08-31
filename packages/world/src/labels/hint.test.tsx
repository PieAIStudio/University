// @vitest-environment jsdom
/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { MapControlsHint, MapEntryHint, mapControlsHint } from "../camera/controls.js";

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

describe("separate map hints", () => {
  it("keeps pan and zoom in the controls slot, with one monochrome glyph per clause", async () => {
    const { host, unmount } = await renderHint(<MapControlsHint />);
    expect(host.textContent).toContain("拖动平移");
    expect(host.textContent).toContain("滚轮缩放");
    expect(host.textContent).not.toContain("点岛进入");
    expect(host.querySelectorAll(".hint__icon, .hint svg")).toHaveLength(2);
    expect(host.innerHTML).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    await unmount();
  });

  it("keeps island entry in its own slot so it can outlive map gestures", async () => {
    const { host, unmount } = await renderHint(<MapEntryHint />);
    expect(host.textContent).toContain("点岛进入");
    expect(host.textContent).not.toContain("拖动平移");
    expect(host.querySelectorAll(".hint__icon, .hint svg")).toHaveLength(1);
    await unmount();
  });

  it("names zoom by pointer, so a phone is never told to use a wheel", async () => {
    const touch = await renderHint(mapControlsHint("touch"));
    expect(touch.host.textContent).toContain("拖动平移");
    expect(touch.host.textContent).toContain("双指缩放");
    expect(touch.host.textContent).not.toContain("点岛进入");
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
    const fnEnd = src.indexOf("export function mapEntryHint");
    const fn = src.slice(fnStart, fnEnd);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fn).toMatch(/pointer === "touch"/);
    expect(fn).toMatch(/translate\("ui.world.mapControlsHint.copy.双指缩放"\)/);
    expect(fn).toMatch(/translate\("ui.world.mapControlsHint.copy.滚轮缩放"\)/);
    expect(fn).not.toMatch(/右键/);
    expect(fn).not.toMatch(/hintItem\("enter"/);
    const entryStart = src.indexOf("export function mapEntryHint");
    const entryEnd = src.indexOf("function subscribeCoarsePointer");
    expect(src.slice(entryStart, entryEnd)).toMatch(/hintItem\("enter"/);
    expect(src).not.toMatch(/MAP_CONTROLS_HINT/);
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

  it("gives hover, entry, and controls their own readable vertical slots", () => {
    expect(ruleBlock(CSS, ".hint--hover")).toMatch(/bottom:\s*116px/);
    expect(ruleBlock(CSS, ".hint--entry")).toMatch(/bottom:\s*68px/);
    expect(ruleBlock(CSS, ".hint--entry")).toMatch(/font-weight:\s*700/);
    expect(ruleBlock(CSS, ".hint--controls")).toMatch(/bottom:\s*20px/);
    expect(CSS).toMatch(/\.hint--dismissed\s*\{[\s\S]*?opacity:\s*0/);
  });

  it("keeps a phone hint on one horizontal line while allowing a narrow viewport to scroll it", () => {
    expect(CSS).toMatch(/\.hint\s*\{[\s\S]*?white-space:\s*nowrap/);
    expect(CSS).toMatch(/@media \(max-width: 400px\)[\s\S]*?\.hint\s*\{[\s\S]*?overflow-x:\s*auto/);
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
