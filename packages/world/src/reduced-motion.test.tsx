// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./reduced-motion.js";

it("reads one media-query owner, follows its live snapshot and unsubscribes", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let matches = false;
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback),
  };
  const matchMedia = vi.fn(() => media);
  vi.stubGlobal("matchMedia", matchMedia);
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  function Subject() {
    return <p>{usePrefersReducedMotion() ? "static" : "moving"}</p>;
  }
  let unmounted = false;
  try {
    await act(async () => root.render(<Subject />));
    expect(element.textContent).toBe("moving");
    for (const next of [true, false, true]) {
      await act(async () => {
        matches = next;
        for (const listener of listeners) listener();
      });
      expect(element.textContent).toBe(next ? "static" : "moving");
      expect(listeners.size).toBe(1);
    }
    expect(matchMedia).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    unmounted = true;
    expect(listeners.size).toBe(0);
  } finally {
    if (!unmounted) await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  }
});
