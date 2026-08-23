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
    courseTitles: ["开场", "地图", "镜头", "灯光", "材质"],
  },
  {
    id: "buzz",
    title: "Buzz",
    courseCount: 5,
    lessonCount: 12,
    lessonsDone: 0,
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
    expect(container.textContent).toContain("学了 1/41 节");
    expect(container.textContent).toContain("开场");
    expect(container.textContent).toContain("还有 1 门");
    expect(container.textContent).not.toMatch(/探索|旅程|开启|精彩|沉浸|世界级|带你/);

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
      (node.textContent ?? "").includes("进入这个项目"),
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
    expect(rows.map((node) => node.getAttribute("data-study-id"))).toEqual(["turing-pact", "buzz"]);
  });
});
