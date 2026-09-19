// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MapEntryAction } from "./MapEntryAction.js";
it("renders one brand entry action without taking over the map or changing focus", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  const sibling = document.createElement("button");
  document.body.append(sibling, host);
  const root = createRoot(host);
  const enter = vi.fn();
  const ref = createRef<HTMLElement>();
  sibling.focus();
  try {
    act(() =>
      root.render(<MapEntryAction title="Actual lesson" onEnter={enter} actionRef={ref} />),
    );
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.querySelector('[role="dialog"],[aria-modal="true"],.path-card__scrim')).toBeNull();
    expect(sibling.inert).not.toBe(true);
    expect(document.activeElement).toBe(sibling);
    expect(host.querySelector("button")?.getAttribute("aria-label")).toContain("Actual lesson");
    act(() => host.querySelector("button")!.click());
    expect(enter).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    host.remove();
    sibling.remove();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  }
});
