// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONCEPT_HEADS, type ConceptHead } from "@pieai/university-core";

import { LoadingTrivia } from "./LoadingTrivia.js";
import { pickLoadingConcept } from "./pick-loading-concept.js";
import { resetLoadingVisitForTests } from "./loading-visit.js";
import { MAP_COVER_GIVE_UP_MS, MAP_COVER_REOPEN_MS, useMapCover } from "./use-map-cover.js";

const SAMPLE: ConceptHead = {
  id: "frontend",
  zh: "前端",
  en: "Frontend",
  category: "frontend",
  group: "网页基础",
  tagline: "你在网页上看到、点到、填进去的那一层。",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  resetLoadingVisitForTests();
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.useFakeTimers();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  resetLoadingVisitForTests();
  vi.useRealTimers();
});

function CoverProbe({ busy }: { readonly busy: boolean }) {
  const cover = useMapCover(busy);
  return <span data-cover={cover ? "yes" : "no"} />;
}

describe("pickLoadingConcept", () => {
  it("returns a real catalogue head, never a placeholder", () => {
    const head = pickLoadingConcept(CONCEPT_HEADS, () => 0);
    expect(head).not.toBeNull();
    expect(head?.zh).toBe(CONCEPT_HEADS[0]?.zh);
    expect(head?.tagline.length).toBeGreaterThan(0);
  });

  it("returns null when the catalogue is empty rather than inventing a line", () => {
    expect(pickLoadingConcept([], () => 0.5)).toBeNull();
  });
});

describe("LoadingTrivia", () => {
  it("prints the concept in the DOM, not as a skeleton", async () => {
    await act(async () => {
      root.render(<LoadingTrivia concept={SAMPLE} />);
    });
    const status = container.querySelector("[role=status]");
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-busy")).toBe("true");
    expect(status?.textContent).toContain("前端");
    expect(status?.textContent).toContain(SAMPLE.tagline);
    expect(status?.textContent).toContain("Frontend");
    expect(status?.textContent).not.toContain("骨架");
  });

  it("stays quiet about a missing catalogue rather than filling one in", async () => {
    await act(async () => {
      root.render(<LoadingTrivia concept={null} />);
    });
    expect(container.textContent).toContain("地图正在打开");
    expect(container.textContent).not.toContain("前端");
  });

  it("on a first visit, says what this is instead of a random concept", async () => {
    await act(async () => {
      root.render(<LoadingTrivia visit="first" />);
    });
    expect(container.textContent).toContain("地图马上铺开");
    expect(container.textContent).toContain("对着真实项目学");
    expect(container.textContent).toContain("每座岛是一门课。点岛进入，读完再练。");
    expect(container.textContent).not.toContain("地图铺开时，看一条概念");
    expect(container.textContent).not.toContain(SAMPLE.zh);
    expect(container.textContent).not.toContain(SAMPLE.en);
  });

  it("on a returning visit, shows a catalogue concept", async () => {
    await act(async () => {
      root.render(<LoadingTrivia visit="returning" concept={SAMPLE} />);
    });
    expect(container.textContent).toContain("地图铺开时，看一条概念");
    expect(container.textContent).toContain("前端");
    expect(container.textContent).not.toContain("对着真实项目学");
  });

  it("treats an unreadable store as a first visit", async () => {
    await act(async () => {
      root.render(<LoadingTrivia storage={null} />);
    });
    expect(container.textContent).toContain("对着真实项目学");
    expect(container.textContent).not.toContain("前端");
  });
});

describe("useMapCover", () => {
  it("covers on the first busy tick and unmounts the moment it is not", async () => {
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("yes");

    await act(async () => {
      root.render(<CoverProbe busy={false} />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");
  });

  it("does not flash on a later busy shorter than the reopen delay", async () => {
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    await act(async () => {
      root.render(<CoverProbe busy={false} />);
    });
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");

    await act(async () => {
      vi.advanceTimersByTime(MAP_COVER_REOPEN_MS - 1);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("yes");
  });

  it("gives up rather than staying up forever", async () => {
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    await act(async () => {
      vi.advanceTimersByTime(MAP_COVER_GIVE_UP_MS);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");
  });
});
