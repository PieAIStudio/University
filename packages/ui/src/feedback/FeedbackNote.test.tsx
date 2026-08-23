// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FeedbackNote } from "./FeedbackNote.js";

let container: HTMLDivElement;
let root: Root;
let rail: HTMLElement;
let footer: HTMLElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  rail = document.createElement("nav");
  rail.className = "nav-rail";
  rail.id = "app-shell-rail";
  footer = document.createElement("div");
  footer.id = "app-shell-rail-footer";
  footer.className = "nav-rail__footer";
  rail.append(footer);
  document.body.append(rail);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  rail.remove();
});

function dispatchPointerSequence(target: Element) {
  const base = { bubbles: true, cancelable: true, clientX: 8, clientY: 8, button: 0 };
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

describe("FeedbackNote in the rail", () => {
  it("docks 提意见 in the rail footer as a button that is not a page link", async () => {
    await act(async () => {
      root.render(<FeedbackNote shell="在线端" />);
    });
    const docked = footer.querySelector("button");
    expect(docked).toBeTruthy();
    expect(docked?.textContent).toContain("提意见");
    expect(docked?.tagName).toBe("BUTTON");
    expect(docked?.getAttribute("href")).toBeNull();
    expect(docked?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(docked?.className).toMatch(/nav-rail__/);
    expect(docked?.querySelector(".nav-rail__icon")).toBeTruthy();
    expect(docked?.querySelector(".nav-rail__label")?.textContent).toBe("提意见");
  });

  it("opens a panel from the docked control instead of navigating", async () => {
    const hashBefore = window.location.hash;
    await act(async () => {
      root.render(<FeedbackNote shell="在线端" />);
    });
    const docked = footer.querySelector("button");
    expect(docked).toBeTruthy();
    await act(async () => {
      dispatchPointerSequence(docked!);
    });
    expect(document.querySelector(".feedback-note")).toBeTruthy();
    expect(document.querySelector(".feedback-note textarea")).toBeTruthy();
    expect(window.location.hash).toBe(hashBefore);
    expect(footer.querySelector("a")).toBeNull();
  });
});
