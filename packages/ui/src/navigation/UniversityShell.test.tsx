// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IslandIcon } from "../shell/icons.js";
import { UniversityShell } from "./UniversityShell.js";
import { MORE_CHILDREN, RAIL_ITEMS, TAB_ITEMS } from "./slots.js";

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

async function renderShell(
  props: Partial<Parameters<typeof UniversityShell>[0]> = {},
): Promise<void> {
  await act(async () => {
    root.render(
      <UniversityShell activeId="learn" identity={null} {...props}>
        <p>主体</p>
      </UniversityShell>,
    );
  });
}

describe("UniversityShell", () => {
  it("mounts the eight rail slots and six tabs in product order", async () => {
    await renderShell();
    const rail = document.querySelector("nav.nav-rail");
    const tabs = document.querySelector("nav.tab-bar");
    expect(RAIL_ITEMS.map((item) => item.id)).toEqual([
      "learn",
      "library",
      "practice",
      "league",
      "quests",
      "plan",
      "profile",
      "more",
    ]);
    expect(TAB_ITEMS.map((item) => item.id)).toEqual([
      "learn",
      "quests",
      "league",
      "library",
      "plan",
      "profile",
    ]);
    expect(rail?.textContent).toContain("学习");
    expect(rail?.textContent).toContain("个人档案");
    expect(tabs?.textContent).toContain("我");
    expect(document.querySelectorAll(".counter-row")).toHaveLength(1);
  });

  it("appends extra more-items to the flyout rather than forking the list", async () => {
    await renderShell({
      extraMoreItems: [
        { id: "studio", label: "作者工作台", icon: <IslandIcon />, href: "/studio" },
      ],
    });
    const trigger = document.querySelector<HTMLButtonElement>(".nav-rail__flyout-trigger");
    await act(async () => {
      trigger?.click();
    });
    const hrefs = [...document.querySelectorAll(".nav-rail__flyout-item")].map((item) =>
      item.getAttribute("href"),
    );
    expect(hrefs).toEqual([...MORE_CHILDREN.map((item) => item.href), "/studio"]);
    expect(document.querySelector("[role='menu']")?.textContent).toContain("作者工作台");
  });

  it("keeps one counter row and two landmarks", async () => {
    await renderShell({
      counters: [{ id: "streak", icon: "🔥", value: "0", label: "连击", muted: true }],
    });
    expect(document.querySelectorAll("nav")).toHaveLength(2);
    expect(document.querySelectorAll(".counter-row")).toHaveLength(1);
  });
});
