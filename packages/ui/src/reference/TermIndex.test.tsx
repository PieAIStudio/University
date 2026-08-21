// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LexiconEntry } from "@pieai/university-core";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("../sound/index.js", () => ({
  playSound,
}));

import { LEXICON_SEARCH_PLACEHOLDER, TermIndex } from "./TermIndex.js";

function sense(
  overrides: Partial<LexiconEntry> & Pick<LexiconEntry, "senseId" | "headword" | "gloss">,
): LexiconEntry {
  return {
    phonetic: "/x/",
    partOfSpeech: "noun",
    usage: `${overrides.headword} 的用法`,
    track: "technical",
    ...overrides,
  };
}

const ENTRIES: readonly LexiconEntry[] = [
  sense({
    senseId: "absorb.failure",
    headword: "absorb",
    gloss: "吸收失败：不往外抛，在本地变成返回值或静默跳过",
  }),
  sense({
    senseId: "app.program",
    headword: "app",
    gloss: "应用：用户点开图标就能用的那个成品",
  }),
  sense({
    senseId: "allow.permit",
    headword: "allow",
    gloss: "允许：放开某种行为或访问",
    track: "general",
  }),
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  playSound.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderIndex(props: Partial<Parameters<typeof TermIndex>[0]> = {}) {
  await act(async () => {
    root.render(<TermIndex entries={ENTRIES} {...props} />);
  });
}

describe("TermIndex", () => {
  it("teaches through the placeholder rather than a blank box", async () => {
    await renderIndex();
    const input = container.querySelector("input[type='search']");
    expect(input?.getAttribute("placeholder")).toBe(LEXICON_SEARCH_PLACEHOLDER);
    expect(LEXICON_SEARCH_PLACEHOLDER).toContain("应用");
    expect(LEXICON_SEARCH_PLACEHOLDER).toContain("点开图标就能用");
  });

  it("groups the full index and puts a count on each group", async () => {
    await renderIndex();
    expect(container.textContent).toContain("技术用语");
    expect(container.textContent).toContain("通用英语");
    expect(container.textContent).toContain("absorb");
    expect(container.textContent).toContain("allow");
  });

  it("turns a miss into the search-syntax manual", async () => {
    await renderIndex({ query: "zzzqqq" });
    expect(container.textContent).toContain("没有找到「zzzqqq」相关的词义");
    expect(container.textContent).toContain("英文词");
    expect(container.textContent).toContain("中文释义");
    expect(container.textContent).toContain("直接描述");
  });

  it("keeps a gloss-only hit and drops the rest", async () => {
    await renderIndex({ query: "不往外抛" });
    expect(container.textContent).toContain("absorb");
    expect(container.textContent).not.toContain("应用：");
    expect(container.textContent).not.toContain("允许：");
  });

  it("filters the visible groups when a track chip is pressed", async () => {
    await renderIndex();
    const general = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("通用英语"),
    );
    expect(general).toBeTruthy();
    await act(async () => {
      general?.click();
    });
    expect(container.textContent).toContain("allow");
    expect(container.textContent).not.toContain("absorb");
  });

  it("opens the existing reference panel and plays panel.open", async () => {
    await renderIndex();
    const hit = [...container.querySelectorAll("button")].find(
      (button) =>
        button.className.includes("term-index__hit") && button.textContent?.includes("absorb"),
    );
    expect(hit).toBeTruthy();
    await act(async () => {
      hit?.click();
    });
    const panel = document.querySelector(".reference-panel");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("data-open")).toBe("true");
    expect(panel?.textContent).toContain("吸收失败");
    expect(playSound).toHaveBeenCalledWith("panel.open");
  });
});
