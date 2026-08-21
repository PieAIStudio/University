// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANTI_PATTERN_ENTRIES,
  ANTI_PATTERN_NOTICE,
  ANTI_PATTERN_NOTICE_HEADING,
} from "@pieai/university-core";

import { ANTI_PATTERN_SEARCH_PLACEHOLDER, AntiPatternIndex } from "./AntiPatternIndex.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderIndex(props: Partial<Parameters<typeof AntiPatternIndex>[0]> = {}) {
  await act(async () => {
    root.render(<AntiPatternIndex entries={ANTI_PATTERN_ENTRIES} {...props} />);
  });
}

describe("AntiPatternIndex", () => {
  it("puts the epistemic notice in the header, not behind a hit", async () => {
    await renderIndex();
    const notice = container.querySelector(".term-index__notice");
    expect(notice?.textContent).toContain(ANTI_PATTERN_NOTICE_HEADING);
    expect(notice?.textContent).toContain(ANTI_PATTERN_NOTICE);
    const search = container.querySelector(".term-index__search");
    expect(
      notice && search && notice.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("teaches through the placeholder and uses the same chip shape as terms", async () => {
    await renderIndex();
    const input = container.querySelector("input[type='search']");
    expect(input?.getAttribute("placeholder")).toBe(ANTI_PATTERN_SEARCH_PLACEHOLDER);
    const chips = [...container.querySelectorAll(".term-index__chip")].map(
      (chip) => chip.textContent?.replace(/\d+/g, "").trim() ?? "",
    );
    expect(chips).toEqual(["全部", "中文口癖", "页面模板感", "不好用的交互"]);
    expect(container.textContent).toContain("25");
    expect(container.textContent).toContain("11");
    expect(container.textContent).toContain("8");
    expect(container.textContent).toContain("6");
  });

  it("filters to one category when a chip is pressed", async () => {
    await renderIndex();
    const template = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("页面模板感"),
    );
    expect(template).toBeTruthy();
    await act(async () => {
      template?.click();
    });
    const hits = [...container.querySelectorAll(".term-index__hit")].map(
      (hit) => hit.textContent ?? "",
    );
    expect(hits.some((text) => text.includes("三张等宽卡片"))).toBe(true);
    expect(hits.some((text) => text.includes("稳稳接住"))).toBe(false);
    expect(hits.some((text) => text.includes("按钮只是摆设"))).toBe(false);
  });

  it("keeps a complaint-only hit and turns a miss into the search-syntax manual", async () => {
    await renderIndex({ query: "稳稳接住你" });
    expect(container.textContent).toContain("稳稳接住");
    expect(container.textContent).not.toContain("三张等宽卡片");

    await renderIndex({ query: "zzzqqq" });
    expect(container.textContent).toContain("没有找到「zzzqqq」相关的条目");
    expect(container.textContent).toContain("口语抱怨");
    expect(container.textContent).toContain("直接描述");
  });

  it("opens a hit through the callback rather than inventing a route", async () => {
    const onOpen = vi.fn();
    await renderIndex({ onOpen });
    const hit = [...container.querySelectorAll("button")].find(
      (button) =>
        button.className.includes("term-index__hit") && button.textContent?.includes("稳稳接住"),
    );
    expect(hit).toBeTruthy();
    await act(async () => {
      hit?.click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]?.head.id).toBe("steady-catch");
  });
});
