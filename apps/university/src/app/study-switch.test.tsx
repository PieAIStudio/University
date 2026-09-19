// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { progressPort } from "../progress/store.js";

vi.mock("@pieai/university-world/WorldMapCanvas.js", () => ({
  WorldMapCanvas: ({ underlay, overlay }: { underlay?: ReactNode; overlay?: ReactNode }) => (
    <>
      {underlay}
      {overlay}
    </>
  ),
}));

vi.mock("../ports/index", () => {
  const lesson = (id: string, title: string) => ({
    id,
    title,
    contentRevision: 1,
    cardCount: 0,
    exerciseCount: 0,
    exerciseIds: [],
    contentChars: 1,
    progress: null,
  });
  const course = (id: string, title: string, lessonTitle: string) => ({
    id,
    title,
    description: "",
    audience: "",
    objectives: [],
    isDefault: true,
    prerequisiteCourseIds: [],
    trackId: null,
    units: [
      {
        id: `${id}-unit`,
        title: "Unit",
        objective: "Objective",
        lessons: [lesson(`${id}-lesson`, lessonTitle)],
      },
    ],
  });
  const studies = [
    {
      id: "alpha",
      title: "Alpha",
      courses: [course("alpha-course", "Alpha Course", "Alpha Lesson")],
    },
    { id: "beta", title: "Beta", courses: [course("beta-course", "Beta Course", "Beta Lesson")] },
  ];
  const studyNames = studies.map(({ id, title }) => ({ id, title }));

  return {
    contentPort: {
      knownStudies: studyNames,
      async studies() {
        return studyNames;
      },
      async shelf() {
        return { studies };
      },
    },
    readerPort: {},
    gradingPort: {},
    sourceAccessPort: {
      uaDashboard: () => ({
        kind: "explanation",
        title: "不可用",
        whatItDoes: "打开项目图谱",
        whyUnavailable: "测试环境没有项目检出",
        futureSupport: "以后支持",
      }),
    },
    feedbackPort: {
      transport: "unavailable",
      submit: async () => {
        throw new Error("feedback unavailable");
      },
      readMine: async () => [],
    },
    reviewReminderPort: {
      snapshot: () => ({ kind: "unsupported", reason: "notifications" }),
      subscribe: () => () => undefined,
      enable: async () => undefined,
      disable: async () => undefined,
      refresh: async () => undefined,
    },
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  progressPort.resetAll();
  sessionStorage.removeItem("university.navigation.study");
  history.replaceState(null, "", "/");
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
  history.replaceState(null, "", "/");
  progressPort.resetAll();
  sessionStorage.removeItem("university.navigation.study");
  vi.unstubAllGlobals();
});

describe("study context", () => {
  it("retains a non-default route when returning from a direct course URL", async () => {
    history.replaceState(null, "", "/beta/beta-course");
    await act(async () => root.render(<App />));
    expect(container.querySelector(".map-shell__heading h2")?.textContent).toBe("Beta Course");
    const back = container.querySelector<HTMLAnchorElement>(
      '.location-breadcrumb__list > li:not(.location-breadcrumb__overflow) > a[href="/"]',
    );
    expect(back?.textContent).toBe("Beta");
    await act(async () => back!.click());
    expect(location.pathname).toBe("/");
    expect(container.querySelector(".map-shell__heading h2")?.textContent).toBe("Beta");
    expect(container.querySelector('[data-map-information="study:beta"]')).not.toBeNull();
    expect(container.querySelector('.location-breadcrumb [aria-current="page"]')?.textContent).toBe(
      "Beta",
    );
  });

  it("keeps the direct course's route across a full document navigation to practice", async () => {
    history.replaceState(null, "", "/beta/beta-course");
    await act(async () => root.render(<App />));
    // A native navigation remounts App; a popstate-only test misses the loss.
    // This simulates that lifecycle; S still drives the real anchor/pointer.
    await act(async () => root.unmount());
    root = createRoot(container);
    history.replaceState(null, "", "/practice");
    await act(async () => root.render(<App />));
    expect(location.pathname).toBe("/practice");
    expect(container.querySelector("[aria-label='当前系列 Beta']")).not.toBeNull();
  });

  it("updates the retained review recommendation and subsequent map context when the study changes", async () => {
    // The recommendation remains in Review; the map's right side now describes
    // a selection rather than repeating a competing Start button.
    history.replaceState(null, "", "/review");
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(
      container.querySelector<HTMLButtonElement>("[aria-label='当前系列 Alpha']"),
    ).toBeTruthy();
    expect(container.textContent).toContain("Alpha · Alpha Course");
    expect(container.textContent).toContain("Alpha Lesson");

    const trigger = container.querySelector<HTMLButtonElement>("[aria-label='当前系列 Alpha']");
    expect(trigger).not.toBeNull();
    await act(async () => trigger!.click());

    const betaOption = [...container.querySelectorAll<HTMLButtonElement>("[role='option']")].find(
      (option) => option.textContent?.startsWith("Beta"),
    );
    expect(betaOption).toBeDefined();
    await act(async () => betaOption!.click());

    expect(container.querySelector<HTMLButtonElement>("[aria-label='当前系列 Beta']")).toBeTruthy();
    expect(container.textContent).toContain("Beta · Beta Course");
    expect(container.textContent).toContain("Beta Lesson");
    expect(container.textContent).not.toContain("Alpha · Alpha Course");
    await act(async () => {
      history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector('[data-map-information="study:beta"]')).not.toBeNull();
    expect(container.querySelector('.location-breadcrumb [aria-current="page"]')?.textContent).toBe(
      "Beta",
    );
  });
});
