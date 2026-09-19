// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocationBreadcrumbs } from "./LocationBreadcrumbs.js";
let cleanup = () => {};
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(() => {
  cleanup();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});
it("keeps real ancestor addresses, a single current page and an expandable complete path", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  cleanup = () => {
    act(() => root.unmount());
    element.remove();
  };
  const navigate = vi.fn();
  const items = [
    { id: "planet", title: "Planets", href: "/planet", onNavigate: navigate },
    { id: "study", title: "Real path", href: "/" },
    { id: "course", title: "Real course", href: "/a/b" },
    { id: "lesson", title: "Real lesson" },
  ];
  act(() => root.render(<LocationBreadcrumbs items={items} />));
  expect(element.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(element.querySelector('[aria-current="page"]')?.textContent).toBe("Real lesson");
  const details = element.querySelector("details")!;
  expect(details.querySelectorAll("a[href]")).toHaveLength(3);
  const first = details.querySelector("a")!;
  act(() =>
    first.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })),
  );
  expect(navigate).toHaveBeenCalledOnce();
  let intercepted = true;
  element.addEventListener(
    "click",
    (event) => {
      intercepted = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  act(() =>
    first.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }),
    ),
  );
  expect(intercepted).toBe(false);
  expect(navigate).toHaveBeenCalledOnce();
  details.open = true;
  act(() =>
    details
      .querySelector("summary")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
  );
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(details.querySelector("summary"));
  details.open = true;
  act(() =>
    root.render(
      <LocationBreadcrumbs
        items={[...items.slice(0, -1), { id: "lesson2", title: "Next lesson" }]}
      />,
    ),
  );
  expect(details.open).toBe(false);
});

it("retains an expandable parent even when a narrow map has only two crumbs", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  cleanup = () => {
    act(() => root.unmount());
    element.remove();
  };
  act(() =>
    root.render(
      <LocationBreadcrumbs
        className="map-breadcrumbs"
        items={[
          { id: "planets", title: "Learning planets", href: "/planet" },
          { id: "study", title: "A real study" },
        ]}
      />,
    ),
  );
  expect(element.querySelector("details a")?.getAttribute("href")).toBe("/planet");
  expect(element.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
});
