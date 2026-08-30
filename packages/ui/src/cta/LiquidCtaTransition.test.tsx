// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiquidCtaButton } from "./LiquidCtaButton.js";
import {
  cancelLiquidCtaTransition,
  computeLiquidFlightFrame,
  LiquidCtaTransitionLayer,
  LiquidDestination,
  setLiquidCtaDebugProgress,
  setLiquidDestination,
  subscribeLiquidCtaTransition,
  liquidCtaTransitionSnapshot,
} from "./LiquidCtaTransition.js";

let container: HTMLDivElement;
let root: Root;
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("liquid-cta")) {
      return new DOMRect(24, 64, 132, 44);
    }
    if (this.dataset.liquidDestination) {
      return new DOMRect(540, 220, 84, 40);
    }
    return originalRect.call(this);
  };
});

afterEach(async () => {
  cancelLiquidCtaTransition();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("computeLiquidFlightFrame", () => {
  const source = { x: 24, y: 64, width: 132, height: 44 };
  const target = { x: 540, y: 220, width: 84, height: 40 };

  it("keeps the authored order: press, stretch, thread, break, land", () => {
    const frames = [0.05, 0.2, 0.5, 0.85, 0.98].map((progress) =>
      computeLiquidFlightFrame(source, target, progress),
    );

    expect(frames.map((frame) => frame.phase)).toEqual([
      "press",
      "stretch",
      "thread",
      "break",
      "land",
    ]);
    expect(frames.map((frame) => frame.travel)).toEqual(
      [...frames].map((frame) => frame.travel).sort((left, right) => left - right),
    );
    expect(frames[2]?.landing.scale).toBe(0.01);
    expect(frames[3]?.source.scale).toBeLessThan(1);
    expect(frames[3]?.landing.scale).toBeGreaterThan(0.01);
    expect(frames[3]?.sourceTravel).toBeLessThan(frames[3]?.travel ?? 0);
    expect(frames[4]?.source.scale).toBe(0.01);
  });

  it("clamps capture progress without changing the destination geometry", () => {
    const frame = computeLiquidFlightFrame(source, target, 9);

    expect(frame.progress).toBe(1);
    expect(frame.phase).toBe("land");
    expect(frame.landing.x).toBe(target.x);
    expect(frame.landing.y).toBe(target.y);
    expect(frame.landing.width).toBe(target.width);
  });
});

describe("LiquidCtaTransitionLayer", () => {
  it("does not schedule a driver while the CTA is resting", async () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    await act(async () => {
      root.render(<LiquidCtaTransitionLayer />);
    });

    expect(requestFrame).not.toHaveBeenCalled();
    requestFrame.mockRestore();
  });

  it("renders one shared overlay and follows deterministic capture progress", async () => {
    const onClick = vi.fn();
    setLiquidDestination("target", { x: 540, y: 220, width: 84, height: 40 });
    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="target" onClick={onClick}>
            开始学习
          </LiquidCtaButton>
        </>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("missing CTA button");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      setLiquidCtaDebugProgress(0.5);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("[data-liquid-cta-flight]")).toHaveLength(1);
    expect(
      container
        .querySelector("[data-liquid-cta-flight-phase]")
        ?.getAttribute("data-liquid-cta-flight-phase"),
    ).toBe("thread");
    expect(
      container
        .querySelector("[data-liquid-cta-flight]")
        ?.getAttribute("data-liquid-cta-flight-travel"),
    ).toBe("0.342");
  });

  it("does not notify or animate when a destination is missing", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiquidCtaTransition(listener);
    setLiquidDestination("missing", null);
    expect(listener).not.toHaveBeenCalled();

    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="missing" onClick={onClick}>
            完成
          </LiquidCtaButton>
        </>,
      );
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("missing CTA button");
    await act(async () => {
      button.click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-liquid-cta-flight]")).toBeNull();
    expect(liquidCtaTransitionSnapshot()?.phase).toBe("pending");
    unsubscribe();
  });

  it("starts as soon as a late destination becomes measurable", async () => {
    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="late-target" onClick={onClick}>
            开始学习
          </LiquidCtaButton>
        </>,
      );
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("missing CTA button");
    await act(async () => button.click());

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(liquidCtaTransitionSnapshot()?.phase).toBe("pending");

    await act(async () => {
      setLiquidDestination("late-target", { x: 540, y: 220, width: 84, height: 40 });
    });

    expect(liquidCtaTransitionSnapshot()?.phase).toBe("active");
    expect(container.querySelector("[data-liquid-cta-flight]")).not.toBeNull();
  });

  it("registers a DOM destination for a route that mounts after the click", async () => {
    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="dom-target" onClick={onClick}>
            完成
          </LiquidCtaButton>
          <LiquidDestination id="dom-target">进度</LiquidDestination>
        </>,
      );
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("missing CTA button");
    await act(async () => button.click());

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(liquidCtaTransitionSnapshot()?.phase).toBe("active");
    expect(liquidCtaTransitionSnapshot()?.target).toEqual({
      x: 540,
      y: 220,
      width: 84,
      height: 40,
    });
  });

  it("skips the transition under reduced motion while keeping the click", async () => {
    const media = {
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    setLiquidDestination("target", { x: 540, y: 220, width: 84, height: 40 });
    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="target" onClick={onClick}>
            开始学习
          </LiquidCtaButton>
        </>,
      );
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("missing CTA button");
    await act(async () => button.click());

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(liquidCtaTransitionSnapshot()).toBeNull();
    expect(container.querySelector("[data-liquid-cta-flight]")).toBeNull();
  });
});
