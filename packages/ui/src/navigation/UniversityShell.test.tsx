// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/react.js";
import { UniversityShell } from "./UniversityShell.js";

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
async function show(props: Partial<Parameters<typeof UniversityShell>[0]> = {}, locale = "zh-CN") {
  await act(async () =>
    root.render(
      <InterfaceLanguageProvider locale={locale}>
        <UniversityShell activeId="learn" identity={null} {...props}>
          <input aria-label="draft" defaultValue="unfinished" />
        </UniversityShell>
      </InterfaceLanguageProvider>,
    ),
  );
}
const rail = () => [...container.querySelectorAll<HTMLAnchorElement>(".nav-rail__list a")];
const tabs = () => [...container.querySelectorAll<HTMLAnchorElement>(".tab-bar a")];

describe("UniversityShell", () => {
  it("mounts the same four labelled doors in the approved order at both placements", async () => {
    await show();
    const hrefs = ["/", "/review", "/library", "/me"];
    expect(rail().map((node) => node.getAttribute("href"))).toEqual(hrefs);
    expect(tabs().map((node) => node.getAttribute("href"))).toEqual(hrefs);
    expect(rail().map((node) => node.textContent)).toEqual(["学习", "复习", "图鉴", "我"]);
    expect(tabs().map((node) => node.textContent)).toEqual(["学习", "复习", "图鉴", "我"]);
    expect(container.querySelector(".nav-rail__flyout-trigger")).toBeNull();
  });
  it("keeps contextual commands outside the four doors and invokes the real command", async () => {
    const command = vi.fn();
    await show({
      contextActions: [
        {
          id: "map-shortcuts",
          label: "快捷操作",
          icon: null,
          href: "#map-shortcuts",
          onActivate: command,
        },
      ],
    });
    const button = container.querySelector<HTMLButtonElement>(
      "[data-shell-command=map-shortcuts]",
    )!;
    await act(async () => button.click());
    expect(command).toHaveBeenCalledOnce();
    expect(rail()).toHaveLength(4);
    expect(tabs()).toHaveLength(4);
    expect(button.closest(".nav-rail__list")).toBeNull();
  });
  it("keeps one counter row and two navigation landmarks", async () => {
    await show({
      counters: [{ id: "streak", icon: "🔥", value: "0", label: "连击", muted: true }],
    });
    expect(container.querySelectorAll("nav")).toHaveLength(2);
    expect(container.querySelectorAll(".counter-row")).toHaveLength(1);
  });
  it("changes all four labels without replacing the learner input or destinations", async () => {
    await show();
    const input = container.querySelector("input")!;
    input.value = "not finished";
    await show({}, "en");
    expect(rail().map((node) => node.textContent)).toEqual(["Learn", "Review", "Library", "Me"]);
    expect(tabs().map((node) => node.textContent)).toEqual(["Learn", "Review", "Library", "Me"]);
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("not finished");
  });
});
