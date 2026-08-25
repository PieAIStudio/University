// @vitest-environment jsdom

import { lessonKey } from "@pieai/university-core";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { progressPort } from "../progress/store.js";

/**
 * The four screens that read a ProgressDocument.
 *
 * They were placeholders in the authoring campus for a while — 「任务还没开张」
 * — which was the last data-level divergence V4 forbids. There is one app now,
 * so the claim is simply that these four read the document. The assertion is
 * the screen itself, not a class name: a wrapper that still said 「还没开张」
 * would pass a smoke test and fail this one.
 *
 * The shelf and the canvas are stubbed because neither is what is under test.
 * A `<Canvas>` in jsdom has no WebGL context to take, and the four screens
 * here never look at a course.
 */
vi.mock("@pieai/university-world/WorldMapCanvas.js", () => ({
  WorldMapCanvas: () => null,
}));

vi.mock("../ports/index", () => ({
  contentPort: {
    async studies() {
      return [{ id: "s", title: "S" }];
    },
    async shelf() {
      return { studies: [{ id: "s", title: "S", courses: [] }] };
    },
  },
  readerPort: {},
  gradingPort: {},
}));
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  progressPort.resetAll();
  window.location.hash = "#/quests";
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.location.hash = "";
  vi.unstubAllGlobals();
});

describe("the four screens that read the progress document", () => {
  it("renders QuestsScreen at #/quests, not the unopened placeholder", async () => {
    await act(async () => {
      root.render(<App />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("学一节新课");
    expect(text).toContain("把连击接上");
    expect(text).not.toContain("任务还没开张");
  });

  it("marks a lesson finished today as done, from the document not a hardcoded empty one", async () => {
    progressPort.advanceLesson(lessonKey("s", "c", "l"), 1);
    await act(async () => {
      root.render(<App />);
    });
    expect(container.textContent).toContain("完成");
    expect(container.textContent).not.toContain("0 / 2");
  });

  it("renders LeagueScreen at #/league, not the unopened placeholder", async () => {
    window.location.hash = "#/league";
    await act(async () => {
      root.render(<App />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("石阶");
    expect(text).toContain("还没有别人可以比");
    expect(text).not.toContain("排行榜还没开");
  });

  it("renders the badge wall on #/me, not the door that said badges live elsewhere", async () => {
    window.location.hash = "#/me";
    await act(async () => {
      root.render(<App />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("连续 7 天来学");
    expect(text).not.toContain("徽章长在投放端");
  });

  it("counts a finished lesson on the profile from the document, not the disk shelf", async () => {
    progressPort.advanceLesson(lessonKey("s", "c", "l"), 1);
    window.location.hash = "#/me";
    await act(async () => {
      root.render(<App />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("学完");
    expect(text).toContain("已获得");
    expect(text).not.toContain("还没学完一节");
  });
});
