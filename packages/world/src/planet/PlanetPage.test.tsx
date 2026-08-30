// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanetPage, type PlanetStudy } from "./PlanetPage.js";

vi.mock("./PlanetScene.js", () => ({
  PlanetStage: () => <div data-planet-stage="true" />,
  PlanetScene: () => null,
}));

const STUDIES: readonly PlanetStudy[] = [
  {
    id: "turing-pact",
    title: "TuringPact",
    courseCount: 31,
    lessonCount: 41,
    lessonsDone: 1,
    courses: [
      { id: "turing-1", title: "开场", lessonCount: 8, depth: 0 },
      { id: "turing-2", title: "地图", lessonCount: 8, depth: 1 },
      { id: "turing-3", title: "镜头", lessonCount: 8, depth: 2 },
      { id: "turing-4", title: "灯光", lessonCount: 8, depth: 3 },
      { id: "turing-5", title: "材质", lessonCount: 9, depth: 4 },
    ],
    courseTitles: ["开场", "地图", "镜头", "灯光", "材质"],
  },
  {
    id: "buzz",
    title: "Buzz",
    courseCount: 5,
    lessonCount: 12,
    lessonsDone: 0,
    courses: [
      { id: "buzz-1", title: "入门", lessonCount: 6, depth: 0 },
      { id: "buzz-2", title: "场景", lessonCount: 6, depth: 1 },
    ],
    courseTitles: ["入门", "场景"],
  },
];

const PAGE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "PlanetPage.tsx"),
  "utf8",
);
const SCENE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "PlanetScene.tsx"),
  "utf8",
);
const PAGE_CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "planet-page.css"),
  "utf8",
);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
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
  vi.unstubAllGlobals();
});

function dispatchPointerSequence(target: EventTarget) {
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: 8,
    clientY: 8,
    button: 0,
  };
  const pointer =
    typeof PointerEvent === "function"
      ? (type: string, buttons: number) =>
          new PointerEvent(type, {
            ...base,
            buttons,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
      : null;
  const mouse = (type: string, buttons: number) => new MouseEvent(type, { ...base, buttons });
  const fire = (type: string, buttons: number) => {
    if (pointer && type.startsWith("pointer")) target.dispatchEvent(pointer(type, buttons));
    else target.dispatchEvent(mouse(type, buttons));
  };
  fire("pointerdown", 1);
  fire("mousedown", 1);
  fire("pointerup", 0);
  fire("mouseup", 0);
  fire("click", 0);
}

describe("PlanetPage contract", () => {
  it("does not read the library or progress itself — those come in as props", () => {
    // Assert on imports, not on the comment that names the things we refuse.
    // A grep of the whole file would ban the sentence explaining the rule.
    expect(PAGE_SRC).not.toMatch(/^import .*from ["'].*(imported\.json|library|progress)/m);
    expect(PAGE_SRC).not.toMatch(/\b(loadGraph|readCourseProgress)\s*\(/);
  });

  it("keeps readable text in the DOM file, not in the canvas file", () => {
    expect(SCENE_SRC).not.toMatch(/TextGeometry|drei\/Html|from "@react-three\/drei"/);
    expect(SCENE_SRC).not.toMatch(/<text|Troika|billboard/i);
  });

  it("does not put backdrop-filter over the canvas, and stacks globe/list at 768px", () => {
    expect(PAGE_CSS).not.toMatch(/^\s*backdrop-filter\s*:/m);
    expect(PAGE_CSS).toMatch(/min-width:\s*768px/);
  });

  it("keeps the enter control as a rail sibling so a phone can put it above optional detail", () => {
    expect(PAGE_SRC).toMatch(/className="planet-page__enter"/);
    expect(PAGE_SRC).not.toMatch(/function StudyDetail[\s\S]*planet-page__enter/);
    expect(PAGE_CSS).toMatch(/grid-area:\s*enter/);
    expect(PAGE_CSS).toMatch(/max-width:\s*767px/);
    expect(PAGE_CSS).toMatch(/"list"[\s\S]*"enter"[\s\S]*"detail"/);
  });
});

describe("PlanetPage", () => {
  it("lists studies in the DOM and selects one from a real pointer sequence, not element.click()", async () => {
    const selected: string[] = [];
    await act(async () => {
      root.render(
        <PlanetPage
          studies={STUDIES}
          selectedId="turing-pact"
          onSelect={(id) => {
            selected.push(id);
          }}
          onEnter={() => undefined}
          onClose={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain("TuringPact");
    expect(container.textContent).toContain("Buzz");
    expect(container.textContent).toContain("31 门课");
    // Where you stand is a chip and a bar now, not a clause in the size line.
    expect(container.textContent).toContain("学习中");
    expect(container.textContent).toContain("2%");
    expect(container.textContent).toContain("开场");
    expect(container.textContent).toContain("还有 1 门");
    expect(container.textContent).not.toMatch(/探索|旅程|开启|精彩|沉浸|世界级|带你/);
    expect(container.querySelectorAll(".planet-page__row-swatch")).toHaveLength(2);

    const buzz = [...container.querySelectorAll("button")].find((node) =>
      (node.textContent ?? "").includes("Buzz"),
    );
    expect(buzz).toBeTruthy();
    await act(async () => {
      dispatchPointerSequence(buzz!);
    });
    expect(selected).toEqual(["buzz"]);
  });

  it("enters the selected study from the action button and closes on Escape", async () => {
    const entered: string[] = [];
    const closed: number[] = [];
    await act(async () => {
      root.render(
        <PlanetPage
          studies={STUDIES}
          selectedId="buzz"
          onSelect={() => undefined}
          onEnter={(id) => {
            entered.push(id);
          }}
          onClose={() => {
            closed.push(1);
          }}
        />,
      );
    });

    expect(container.textContent).toContain("没开始");
    const enter = [...container.querySelectorAll("button")].find((node) =>
      (node.textContent ?? "").includes("进入 "),
    );
    expect(enter).toBeTruthy();
    await act(async () => {
      dispatchPointerSequence(enter!);
    });
    expect(entered).toEqual(["buzz"]);

    await act(async () => {
      // Listeners hang on window, matching CoursePickCard: a keydown
      // dispatched on the container never travels *down* into the dialog.
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(closed).toEqual([1]);
  });

  it("exposes each study as a button so a real Enter key (Playwright) selects it", async () => {
    await act(async () => {
      root.render(
        <PlanetPage
          studies={STUDIES}
          selectedId="turing-pact"
          onSelect={() => undefined}
          onEnter={() => undefined}
          onClose={() => undefined}
        />,
      );
    });
    const rows = [...container.querySelectorAll("[data-study-id]")];
    expect(rows.map((node) => node.tagName)).toEqual(["BUTTON", "BUTTON"]);
    /*
      By title, not in the order the caller passed them. The two shells read
      their catalogues from different places and handed this component two
      different orders for the same five series; the list is sorted here so a
      reader does not have to relearn it when they change campus. `STUDIES`
      arrives TuringPact-then-Buzz, and Buzz sorts first.
    */
    expect(rows.map((node) => node.getAttribute("data-study-id"))).toEqual(["buzz", "turing-pact"]);
  });

  it("keeps the higher shared-world cluster contract and the project colour in the DOM", () => {
    expect(SCENE_SRC).toContain("buildWorldStudyGrid");
    expect(SCENE_SRC).toContain("WorldHexField");
    expect(SCENE_SRC).toContain("Weather");
    expect(SCENE_SRC).toContain("COURSE_SKY_STOPS");
    expect(SCENE_SRC).toContain("placePlanetClusters");
    expect(SCENE_SRC).toContain("PLANET_CAMERA_POLAR");
    expect(SCENE_SRC).toContain("PLANET_ATMOSPHERE");
    expect(SCENE_SRC).toContain("selectedScale");
    expect(SCENE_SRC).not.toMatch(
      /Icosahedron|sphericalFbm|buildPlanetGeometry|FloatingStudyCluster/,
    );
    expect(SCENE_SRC).not.toMatch(
      /PIN_PROFILE|PIN_SCREEN_LIFT|PIN_BEAM_HEIGHT|latheGeometry|MARKER_QUIET/,
    );
  });
});
