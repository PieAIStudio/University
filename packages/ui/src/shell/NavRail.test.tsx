// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ShellNavItem } from "./AppShell.js";
import { NavRail } from "./NavRail.js";

const ITEMS: readonly ShellNavItem[] = [
  { id: "home", label: "学习", icon: "H", href: "#/home" },
  { id: "codex", label: "图鉴", icon: "C", href: "#/codex" },
  {
    id: "more",
    label: "更多",
    icon: "M",
    href: "#/more",
    children: [
      { id: "settings", label: "设置", icon: "S", href: "#/settings" },
      { id: "help", label: "帮助", icon: "?", href: "#/help" },
    ],
  },
];

let container: HTMLDivElement;
let root: Root;
let outside: HTMLButtonElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  outside = document.createElement("button");
  outside.textContent = "页面上的其他按钮";
  document.body.append(outside);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  outside.remove();
});

async function renderRail(activeId = "home"): Promise<void> {
  await act(async () => {
    root.render(<NavRail items={ITEMS} activeId={activeId} brand="Brand" />);
  });
}

function trigger(): HTMLButtonElement {
  const node = document.querySelector<HTMLButtonElement>(".nav-rail__flyout-trigger");
  if (!node) throw new Error("missing flyout trigger");
  return node;
}

function menu(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[role="menu"]');
  if (!node) throw new Error("missing menu");
  return node;
}

describe("NavRail", () => {
  it("names the rail and keeps item labels in the accessible name even when they are a visual-only icon rail later", async () => {
    await renderRail();
    const nav = document.querySelector("nav.nav-rail");
    expect(nav?.getAttribute("aria-label")).toBe("Primary");
    expect(nav?.textContent).toContain("Brand");
    expect(nav?.textContent).toContain("学习");
    expect(nav?.textContent).toContain("图鉴");
    expect(nav?.textContent).toContain("更多");
  });

  it("puts aria-current on the matching link only", async () => {
    await renderRail("codex");
    const current = document.querySelectorAll(".nav-rail [aria-current='page']");
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("href")).toBe("#/codex");
    expect(current[0]?.tagName).toBe("A");
  });

  it("opens as a menu, moves focus to the first item, and does not trap it", async () => {
    await renderRail();
    await act(async () => {
      trigger().click();
    });
    const items = [...menu().querySelectorAll<HTMLAnchorElement>("[role='menuitem']")];
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(menu().getAttribute("role")).toBe("menu");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector(".nav-rail__scrim")).toBeNull();
    expect(items.map((item) => item.getAttribute("href"))).toEqual(["#/settings", "#/help"]);
    expect(document.activeElement).toBe(items[0]);

    outside.focus();
    expect(document.activeElement).toBe(outside);
    expect(menu()).toBeTruthy();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    await renderRail();
    await act(async () => {
      trigger().click();
    });
    expect(document.activeElement).toBe(menu().querySelector("[role='menuitem']"));

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("closes when the pointer presses outside, without a scrim", async () => {
    await renderRail();
    await act(async () => {
      trigger().click();
    });
    expect(document.querySelector('[role="menu"]')).toBeTruthy();

    await act(async () => {
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector(".nav-rail__scrim")).toBeNull();
  });

  it("marks the trigger current when a child page is active and the menu is closed", async () => {
    await renderRail("settings");
    expect(trigger().getAttribute("aria-current")).toBe("page");
    await act(async () => {
      trigger().click();
    });
    expect(trigger().getAttribute("aria-current")).toBeNull();
    expect(menu().querySelector("[aria-current='page']")?.getAttribute("href")).toBe("#/settings");
  });
});
