// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StudySwitcher, studySwitchMeta, type StudySwitchItem } from "./StudySwitcher.js";

const STUDIES: readonly StudySwitchItem[] = [
  { id: "turing-pact", title: "TuringPact", courseCount: 31, done: 1, total: 41 },
  { id: "buzz", title: "Buzz", courseCount: 5, done: 0, total: 12 },
  { id: "supaluv", title: "SupaLuv", courseCount: 7, done: 0, total: 20 },
  { id: "university-local", title: "UniversityLocal", courseCount: 9, done: 0, total: 30 },
];

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

function dispatchPointerSequence(target: Element) {
  const base = { bubbles: true, cancelable: true, clientX: 4, clientY: 4, button: 0 };
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

describe("studySwitchMeta", () => {
  it("says 没开始 before any lesson is done, and 学到 once there is progress", () => {
    expect(studySwitchMeta(STUDIES[1]!)).toBe("5 门 · 没开始");
    expect(studySwitchMeta(STUDIES[0]!)).toBe("31 门 · 学到 1/41");
  });
});

describe("StudySwitcher", () => {
  it("lists every project and reports the pick", async () => {
    const picked: string[] = [];
    await act(async () => {
      root.render(
        <StudySwitcher
          studies={STUDIES}
          focusedId="turing-pact"
          onSelect={(id) => {
            picked.push(id);
          }}
        />,
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(".study-switcher__trigger");
    expect(trigger?.textContent).toContain("TuringPact");
    expect(container.querySelector("[role='listbox']")).toBeNull();

    await act(async () => {
      dispatchPointerSequence(trigger!);
    });
    const options = [...container.querySelectorAll("[role='option']")].map((node) =>
      (node.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    expect(options).toEqual([
      "TuringPact 31 门 · 学到 1/41",
      "Buzz 5 门 · 没开始",
      "SupaLuv 7 门 · 没开始",
      "UniversityLocal 9 门 · 没开始",
    ]);

    const buzz = [...container.querySelectorAll("[role='option']")].find((node) =>
      (node.textContent ?? "").includes("Buzz"),
    );
    await act(async () => {
      dispatchPointerSequence(buzz!);
    });
    expect(picked).toEqual(["buzz"]);
  });
});
