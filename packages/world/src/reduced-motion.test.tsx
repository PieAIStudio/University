// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reducedMotionNow,
  subscribeReducedMotion,
  usePrefersReducedMotion,
} from "./reduced-motion.js";

afterEach(() => vi.unstubAllGlobals());

function mediaFixture(initial = false) {
  let matches = initial;
  const media = new EventTarget();
  Object.defineProperty(media, "matches", { get: () => matches });
  const add = vi.spyOn(media, "addEventListener"),
    remove = vi.spyOn(media, "removeEventListener");
  const matchMedia = vi.fn(() => media as unknown as MediaQueryList);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    add,
    remove,
    set(value: boolean, announce = true) {
      matches = value;
      if (announce) media.dispatchEvent(new Event("change"));
    },
  };
}

describe("browser-owned motion preference", () => {
  it("reuses the media object but reads its current value and cleans subscriptions", () => {
    const media = mediaFixture();
    const callback = vi.fn();
    const stop = subscribeReducedMotion(callback);
    for (let i = 0; i < 120; i++) expect(reducedMotionNow()).toBe(false);
    media.set(true, false);
    expect(reducedMotionNow()).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    media.set(true);
    expect(callback).toHaveBeenCalledTimes(1);
    stop();
    media.set(false);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(media.matchMedia).toHaveBeenCalledTimes(1);
    expect(media.remove).toHaveBeenCalledWith("change", callback);
  });

  it("commits the shared preference before layout resets, then unsubscribes on unmount", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const media = mediaFixture(true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const frames: boolean[] = [];
    function Probe() {
      const reduced = usePrefersReducedMotion();
      useLayoutEffect(() => {
        frames.push(reduced);
      }, [reduced]);
      return <span>{reduced ? "still" : "moving"}</span>;
    }
    try {
      await act(() => {
        root.render(
          <>
            <Probe />
            <Probe />
          </>,
        );
      });
      expect(container.textContent).toBe("stillstill");
      await act(() => {
        media.set(false);
      });
      expect(container.textContent).toBe("movingmoving");
      await act(() => {
        media.set(true);
      });
      expect(container.textContent).toBe("stillstill");
      expect(frames).toEqual([true, true, false, false, true, true]);
      expect(media.matchMedia).toHaveBeenCalledTimes(1);
    } finally {
      await act(() => {
        root.unmount();
      });
    }
    expect(media.remove).toHaveBeenCalledTimes(media.add.mock.calls.length);
  });
});
