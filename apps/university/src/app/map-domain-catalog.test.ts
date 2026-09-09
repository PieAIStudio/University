// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { PlanetSceneProps, PlanetStudy } from "@pieai/university-world/planet.js";
import { App } from "./App.js";
import { mapDomainCatalog, mapDomainForStudy, studyForMapDomain } from "./map-domain-catalog.js";

vi.mock("@pieai/university-world/WorldMapCanvas.js", () => ({ WorldMapCanvas: () => null }));
vi.mock("@pieai/university-world/planet.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@pieai/university-world/planet.js")>()),
  // DOM/state integration only. This seam deliberately makes no assertion
  // about a WebGL canvas drawing the planets or about real pointer picking.
  PlanetStage: (props: PlanetSceneProps) =>
    createElement(
      "div",
      {
        "data-test-planet-stage": true,
        "data-selected-domain": props.selectedDomainId,
        "data-selected-study": props.selectedId,
        "data-catalog": props.domainCatalog?.map((domain) => domain.id).join(","),
      },
      props.domainCatalog?.map((domain) =>
        createElement(
          "button",
          {
            key: domain.id,
            "data-test-globe-domain": domain.id,
            onClick: () => props.onSelectDomain?.(domain.id),
          },
          domain.title,
        ),
      ),
    ),
}));
vi.mock("../ports/index", () => {
  const studies = [
    { id: "browser-ai", title: "学会用 AI 做应用", courses: [] },
    { id: "turing-pact", title: "TuringPact", courses: [] },
  ];
  return {
    contentPort: { studies: async () => studies, shelf: async () => ({ studies }) },
    readerPort: {},
    gradingPort: {},
    sourceAccessPort: {},
    feedbackPort: {
      transport: "unavailable",
      readMine: async () => [],
      submit: async () => {
        throw new Error("unavailable");
      },
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

function study(id: string, domainId: string): PlanetStudy {
  return {
    id,
    title: id,
    domain: { id: domainId, title: domainId },
    courseCount: 0,
    lessonCount: 0,
    lessonsDone: 0,
    courses: [],
    courseTitles: [],
  };
}

describe("map domain catalogue", () => {
  it("declares four real domain identities and only authored domain-level positioning", () => {
    const catalog = mapDomainCatalog();
    expect(catalog.map((domain) => domain.id)).toEqual([
      "programming",
      "ai-foundations",
      "ai-games",
      "ai-media",
    ]);
    expect(catalog.map((domain) => domain.title)).toEqual([
      "AI 与编程",
      "AI 基础",
      "AI 与游戏",
      "AI 媒体创作",
    ]);
    expect(catalog.map((domain) => domain.surfaceStyle)).toEqual([
      "meadow",
      "dawn",
      "lagoon",
      "iris",
    ]);
    for (const domain of catalog) {
      expect(domain.description?.length).toBeGreaterThan(5);
      expect(domain).not.toHaveProperty("studies");
      expect(domain).not.toHaveProperty("courses");
      expect(domain).not.toHaveProperty("lessonsDone");
    }
  });

  it("assigns each learning route once by learning goal, not project name", () => {
    expect(mapDomainForStudy("general").id).toBe("programming");
    expect(mapDomainForStudy("browser-ai").id).toBe("programming");
    expect(mapDomainForStudy("turing-pact").id).toBe("ai-games");
    expect(mapDomainForStudy("ai-foundations").id).toBe("ai-foundations");
    for (const retired of ["buzz", "supaluv"]) {
      expect(mapDomainForStudy(retired).id).toBe("unclassified");
    }
  });

  it("keeps unknown studies visible without guessing from their names", () => {
    for (const id of ["aigc-video", "programming-basics", "toString", "__proto__", ""]) {
      expect(mapDomainForStudy(id)).toEqual({ id: "unclassified", title: "未分类" });
    }
  });

  it("places the integrated browser AI application series in its explicitly assigned domain", () => {
    expect(mapDomainForStudy("browser-ai").id).toBe("programming");
    expect(mapDomainForStudy("browser-ai-unregistered").id).toBe("unclassified");
  });

  it("restores the domain's actual selected study before a deterministic first-row fallback", () => {
    const studies = [
      study("c", "programming"),
      study("b", "programming"),
      study("media", "ai-media"),
    ];
    expect(studyForMapDomain("programming", studies, "c")).toBe("c");
    expect(studyForMapDomain("programming", studies, "media", "c")).toBe("c");
    expect(studyForMapDomain("programming", studies, "media", "removed")).toBe("b");
    expect(studyForMapDomain("programming", [...studies].reverse(), "media", "removed")).toBe("b");
    expect(studyForMapDomain("ai-foundations", studies, "c", "c")).toBeNull();
    expect(studyForMapDomain("absent", studies, "c")).toBeNull();
  });

  it("wires the formal App rail and stage to one domain owner and retains a non-first study after empty-planet visits", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    history.replaceState(null, "", "/planet");
    const click = async (selector: string) => {
      const button = container.querySelector(selector);
      expect(button, selector).not.toBeNull();
      await act(async () => button!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    };
    const stage = () => container.querySelector("[data-test-planet-stage]")!;
    try {
      await act(async () => root.render(createElement(StrictMode, null, createElement(App))));
      expect(stage().getAttribute("data-catalog")).toBe(
        "programming,ai-foundations,ai-games,ai-media",
      );
      await click('[data-test-globe-domain="ai-games"]');
      await click('button[data-study-id="turing-pact"]');
      expect(stage().getAttribute("data-selected-study")).toBe("turing-pact");
      for (const domain of ["ai-foundations", "ai-media"]) {
        // The stage callback and the rail callback must converge on the same owner.
        await click(`[data-test-globe-domain="${domain}"]`);
        expect(stage().getAttribute("data-selected-domain")).toBe(domain);
        expect(stage().getAttribute("data-selected-study")).toBe("turing-pact");
        expect(
          container
            .querySelector(`button[data-domain-id="${domain}"]`)
            ?.getAttribute("aria-pressed"),
        ).toBe("true");
        expect(container.querySelectorAll("[data-study-id]")).toHaveLength(0);
        expect(container.querySelector(".planet-page__enter")).toBeNull();
        expect(container.querySelector("[data-domain-empty]")?.textContent).toContain("暂未发布");
      }
      await click(".planet-page__return");
      expect(stage().getAttribute("data-selected-domain")).toBe("ai-games");
      expect(stage().getAttribute("data-selected-study")).toBe("turing-pact");
      expect(container.querySelector(".planet-page__enter")?.textContent).toContain("TuringPact");
      expect(
        container
          .querySelector('button[data-study-id="turing-pact"]')
          ?.getAttribute("aria-pressed"),
      ).toBe("true");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      history.replaceState(null, "", "/");
      vi.unstubAllGlobals();
    }
  });
});
