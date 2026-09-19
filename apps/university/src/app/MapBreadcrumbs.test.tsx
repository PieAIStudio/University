// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapBreadcrumbs } from "./MapBreadcrumbs.js";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("the three map levels share an accessible hierarchy", () => {
  it.each(["world", "course"] as const)(
    "keeps %s current when asynchronous titles are absent",
    (layer) => {
      act(() => root.render(<MapBreadcrumbs layer={layer} onNavigate={() => undefined} />));
      expect(host.querySelector("[aria-current=page]")?.textContent).toBe(
        layer === "world" ? "飞岛群" : "课程岛",
      );
      expect(host.querySelector('a[href="/planet"]')).not.toBeNull();
    },
  );
  it.each(["planet", "world", "course"] as const)(
    "marks exactly one current place on %s",
    (layer) => {
      act(() =>
        root.render(
          <MapBreadcrumbs
            layer={layer}
            studyTitle="学会用 AI 做游戏"
            courseTitle="在开始之前：App、代码、和你"
            onNavigate={() => {}}
          />,
        ),
      );
      expect(host.querySelector("nav")?.getAttribute("aria-label")).toBe("当前位置");
      expect(host.querySelectorAll("[aria-current=page]")).toHaveLength(1);
      expect(
        host.querySelectorAll(
          ".location-breadcrumb__list > li:not(.location-breadcrumb__overflow) > a",
        ),
      ).toHaveLength(layer === "planet" ? 0 : layer === "world" ? 1 : 2);
      expect(host.querySelector("[aria-current]")?.textContent).toBe(
        layer === "planet"
          ? "学习星球"
          : layer === "world"
            ? "学会用 AI 做游戏"
            : "在开始之前：App、代码、和你",
      );
    },
  );

  it("keeps real ancestor URLs, complete long names and ordinary same-tab routing", () => {
    const onNavigate = vi.fn();
    const title = "这个课程的完整名称即使很长也不能丢失".repeat(4);
    act(() =>
      root.render(
        <MapBreadcrumbs
          layer="course"
          studyTitle="游戏系列"
          courseTitle={title}
          onNavigate={onNavigate}
        />,
      ),
    );
    const links = host.querySelectorAll(
      ".location-breadcrumb__list > li:not(.location-breadcrumb__overflow) > a",
    );
    // The narrow-screen full-path disclosure retains the same real ancestors.
    const overflowLinks = host.querySelectorAll("details a");
    expect([...overflowLinks].map((link) => link.getAttribute("href"))).toEqual(["/planet", "/"]);
    expect([...links].map((link) => link.getAttribute("href"))).toEqual(["/planet", "/"]);
    expect(host.querySelector("[aria-current]")?.getAttribute("title")).toBe(title);
    for (const link of links) {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      act(() => link.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
    }
    expect(onNavigate.mock.calls.map(([view]) => view.kind)).toEqual(["planet", "world"]);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"] as const)(
    "leaves %s clicks to the browser",
    (key) => {
      const onNavigate = vi.fn();
      act(() =>
        root.render(<MapBreadcrumbs layer="world" studyTitle="游戏系列" onNavigate={onNavigate} />),
      );
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, [key]: true });
      // Cancel at the outer listener only AFTER the React handler: jsdom must
      // not try to navigate, while the assertion observes the component itself.
      let intercepted = false;
      host.addEventListener("click", (click) => {
        intercepted = click.defaultPrevented;
        click.preventDefault();
      });
      act(() => host.querySelector("a")!.dispatchEvent(event));
      expect(intercepted).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    },
  );
});
