// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppShell, type ShellCounter, type ShellNavItem } from "./AppShell.js";

const NAV: readonly ShellNavItem[] = [
  { id: "home", label: "学习", icon: "H", href: "#/home" },
  {
    id: "quests",
    label: "任务",
    icon: "Q",
    href: "#/quests",
    badge: 3,
    badgeLabel: "任务，3 项未完成",
  },
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

const TABS: readonly ShellNavItem[] = [
  { id: "home", label: "学习", icon: "H", href: "#/home" },
  { id: "quests", label: "任务", icon: "Q", href: "#/quests" },
];

const COUNTERS: readonly ShellCounter[] = [
  { id: "island", icon: "🏝", label: "当前项目", href: "#/switch" },
  { id: "streak", icon: "🔥", value: "0", label: "连击", muted: true },
  { id: "credit", icon: "💎", value: "120", label: "学分", href: "#/credit" },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}): Promise<void> {
  await act(async () => {
    root.render(
      <AppShell nav={NAV} tabs={TABS} activeId="home" counters={COUNTERS} {...props}>
        <p>主体</p>
      </AppShell>,
    );
  });
}

function rail(): HTMLElement {
  const node = document.querySelector<HTMLElement>("nav.nav-rail");
  if (!node) throw new Error("missing nav rail");
  return node;
}

function tabs(): HTMLElement {
  const node = document.querySelector<HTMLElement>("nav.tab-bar");
  if (!node) throw new Error("missing tab bar");
  return node;
}

describe("AppShell", () => {
  it("keeps one counter row in the tree, as a named grid item rather than a second copy", async () => {
    await renderShell();
    expect(document.querySelectorAll(".counter-row")).toHaveLength(1);
    expect(document.querySelectorAll("nav")).toHaveLength(2);
    expect(rail().getAttribute("aria-label")).toBeTruthy();
    expect(tabs().getAttribute("aria-label")).toBeTruthy();
    expect(rail().getAttribute("aria-label")).not.toBe(tabs().getAttribute("aria-label"));
  });

  it("puts every ordinary nav item and tab on a real href, in visual order", async () => {
    await renderShell();
    const railLinks = [...rail().querySelectorAll("a")];
    expect(railLinks.map((link) => link.getAttribute("href"))).toEqual(["#/home", "#/quests"]);
    expect(railLinks.every((link) => link.tagName === "A")).toBe(true);

    const tabLinks = [...tabs().querySelectorAll("a")];
    expect(tabLinks.map((link) => link.getAttribute("href"))).toEqual(["#/home", "#/quests"]);
    expect(tabLinks.map((link) => link.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("学习"), expect.stringContaining("任务")]),
    );
  });

  it("marks exactly one current page in the rail and one in the tab bar", async () => {
    await renderShell({ activeId: "home" });
    const railCurrent = rail().querySelectorAll('[aria-current="page"]');
    const tabCurrent = tabs().querySelectorAll('[aria-current="page"]');
    expect(railCurrent).toHaveLength(1);
    expect(tabCurrent).toHaveLength(1);
    expect(railCurrent[0]?.getAttribute("href")).toBe("#/home");
    expect(tabCurrent[0]?.getAttribute("href")).toBe("#/home");
  });

  it("names the aside landmark from the prop, and leaves it out when there is no aside", async () => {
    await renderShell({ aside: <p>右栏</p>, asideLabel: "上下文" });
    const aside = document.querySelector("aside");
    expect(aside?.getAttribute("aria-label")).toBe("上下文");
    expect(aside?.textContent).toContain("右栏");

    await renderShell({ aside: undefined });
    expect(document.querySelector("aside")).toBeNull();
  });

  it("renders the flyout item as a menu button, not a link, and keeps children off the tree until opened", async () => {
    await renderShell();
    const trigger = rail().querySelector<HTMLButtonElement>(".nav-rail__flyout-trigger");
    expect(trigger?.tagName).toBe("BUTTON");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector(".nav-rail__scrim")).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("puts the badge phrase on the link so a count is not a bare digit", async () => {
    await renderShell();
    const quests = [...rail().querySelectorAll("a")].find(
      (link) => link.getAttribute("href") === "#/quests",
    );
    expect(quests?.getAttribute("aria-label")).toBe("任务，3 项未完成");
    expect(quests?.textContent).toContain("3");
  });

  it("names a muted zero counter instead of hiding the slot", async () => {
    await renderShell();
    const streak = document.querySelector('[aria-label="连击 0"]');
    expect(streak).toBeTruthy();
    expect(streak?.className).toContain("counter-row__item--muted");
    expect(document.querySelector('[aria-label="当前项目"]')?.getAttribute("href")).toBe(
      "#/switch",
    );
  });

  it("renders main children once, and still emits one empty counter row when none are passed", async () => {
    await renderShell({ counters: undefined });
    expect(document.querySelector("main")?.textContent).toContain("主体");
    expect(document.querySelectorAll(".counter-row")).toHaveLength(1);
    expect(document.querySelector(".counter-row")?.children).toHaveLength(0);
  });

  it("gives each floating column a collapse control and remembers the choice", async () => {
    localStorage.clear();
    await renderShell({ aside: <p>右栏</p>, asideLabel: "上下文" });
    const rail = document.querySelector<HTMLButtonElement>(".app-shell__collapse--rail");
    const aside = document.querySelector<HTMLButtonElement>(".app-shell__collapse--aside");
    expect(rail).toBeTruthy();
    expect(aside).toBeTruthy();
    expect(document.querySelector(".app-shell")?.getAttribute("data-rail-collapsed")).toBe("false");

    await act(async () => {
      dispatchPointerSequence(rail!, 8, 8);
    });
    expect(document.querySelector(".app-shell")?.getAttribute("data-rail-collapsed")).toBe("true");
    expect(localStorage.getItem("app-shell.collapsed")).toContain('"rail":true');

    await act(async () => root.unmount());
    root = createRoot(container);
    await renderShell({ aside: <p>右栏</p>, asideLabel: "上下文" });
    expect(document.querySelector(".app-shell")?.getAttribute("data-rail-collapsed")).toBe("true");
  });
});

function dispatchPointerSequence(target: Element, x: number, y: number) {
  const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
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
