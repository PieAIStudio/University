// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PracticeOverview, type PracticeOverviewCategory } from "./PracticeOverview.js";

const CATEGORIES: readonly PracticeOverviewCategory[] = [
  { id: "frontend", label: "前端", count: 137 },
  { id: "backend", label: "后端", count: 40 },
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

function renderOverview(overrides: Partial<ComponentProps<typeof PracticeOverview>> = {}) {
  return act(async () => {
    root.render(
      <PracticeOverview
        categories={CATEGORIES}
        dueTodayCount={0}
        dueTomorrowCount={0}
        questionCount={281}
        recentCount={0}
        {...overrides}
      />,
    );
  });
}

describe("PracticeOverview", () => {
  it("answers whether practice is due without inventing mastery", async () => {
    await renderOverview();

    expect(container.querySelector("h1")?.textContent).toBe("练一点，记得更牢。");
    expect(container.querySelector("[data-practice-details]")?.hasAttribute("open")).toBe(false);
    expect(container.querySelector(".practice-overview__facts")?.textContent).toContain(
      "今天复习没有",
    );
    expect(container.textContent).toContain("281 个概念题");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.textContent).not.toContain("已掌握 0");
  });

  it("offers the existing review route only when cards are due", async () => {
    const onOpenReview = vi.fn();
    await renderOverview({ dueTodayCount: 3, onOpenReview });

    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("先去复习"),
    );
    expect(container.textContent).toContain("今天有 3 张卡片等你复习");
    expect(button).toBeTruthy();
    await act(async () => button?.click());
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });
});
