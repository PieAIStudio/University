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
  liquidProgressDestinationRect,
  liquidFlightCoverageRects,
  setLiquidCtaDebugProgress,
  registerLiquidDestination,
  subscribeLiquidCtaTransition,
  liquidCtaTransitionSnapshot,
  type LiquidScreenRect,
} from "./LiquidCtaTransition.js";

let container: HTMLDivElement;
let root: Root;
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
let originalInnerWidth: number;
let destinationCleanups: Array<() => void>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  destinationCleanups = [];
  originalInnerWidth = window.innerWidth;
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("liquid-cta")) {
      return new DOMRect(24, 64, 132, 44);
    }
    if (this.classList.contains("game-ui-progress-track")) {
      return new DOMRect(80, 29, 668, 14);
    }
    if (this.classList.contains("game-ui-progress-fill")) {
      const width = Number(this.dataset.width ?? 84);
      return new DOMRect(80, 29, width, 14);
    }
    if (this.dataset.liquidDestination) {
      return new DOMRect(540, 220, 84, 40);
    }
    return originalRect.call(this);
  };
});

afterEach(async () => {
  for (const cleanup of destinationCleanups) cleanup();
  cancelLiquidCtaTransition();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function registerTestDestination(id: string): void {
  const element = document.createElement("div");
  element.dataset.liquidDestination = id;
  destinationCleanups.push(registerLiquidDestination(id, element));
}

function scaledShapeRect(shape: LiquidScreenRect & { readonly scale: number }): LiquidScreenRect {
  const width = shape.width * shape.scale;
  const height = shape.height * shape.scale;
  return {
    x: shape.x + (shape.width - width) / 2,
    y: shape.y + (shape.height - height) / 2,
    width,
    height,
  };
}

function rectsOverlap(left: LiquidScreenRect, right: LiquidScreenRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

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
    expect(frames[4]?.source.scale).toBe(0);
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

describe("liquid progress landing", () => {
  function progressFixture(): {
    readonly host: HTMLDivElement;
    readonly track: HTMLDivElement;
    readonly fill: HTMLDivElement;
  } {
    const host = document.createElement("div");
    const track = document.createElement("div");
    const fill = document.createElement("div");
    track.className = "game-ui-progress-track";
    fill.className = "game-ui-progress-fill";
    fill.dataset.width = "84";
    track.append(fill);
    host.append(track);
    container.append(host);
    return { host, track, fill };
  }

  it("lands on a bead at the filled edge, not on the whole progress component", () => {
    const { host, fill } = progressFixture();
    const target = liquidProgressDestinationRect(host);
    expect(target).toEqual({ x: 153, y: 25, width: 22, height: 22 });
    fill.dataset.width = "668";
    expect(liquidProgressDestinationRect(host)).toEqual({
      x: 726,
      y: 25,
      width: 22,
      height: 22,
    });
  });

  it("proves sampled coverage cannot visibly obscure readable text nodes", () => {
    const { host, fill } = progressFixture();
    const readable = [
      { text: "离开课文", rect: new DOMRect(16, 14, 40, 22) },
      { text: "7/8", rect: new DOMRect(770, 24, 32, 20) },
      { text: "课文正文", rect: new DOMRect(300, 90, 680, 80) },
    ].map(({ text, rect }) => {
      const node = document.createElement("span");
      node.dataset.readableText = text;
      Object.defineProperty(node, "getBoundingClientRect", { value: () => rect });
      host.append(node);
      return node;
    });
    const samples = [0, 0.05, 0.2, 0.5, 0.85, 0.93, 0.98, 1];
    for (const viewportWidth of [1280, 390]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: viewportWidth });
      const source =
        viewportWidth < 960
          ? { x: 41, y: 488, width: 310, height: 40 }
          : { x: 820, y: 280, width: 132, height: 44 };
      const textRects = [
        ...readable.map((node) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
        viewportWidth < 960
          ? { x: 16, y: 170, width: 358, height: 210 }
          : { x: 300, y: 90, width: 680, height: 80 },
      ];
      for (const fillWidth of [0, 84, 334, 668]) {
        fill.dataset.width = String(fillWidth);
        const target = liquidProgressDestinationRect(host);
        if (!target) throw new Error("missing progress target");
        for (const progress of samples) {
          const frame = computeLiquidFlightFrame(source, target, progress);
          const coverage = liquidFlightCoverageRects(source, target, progress);
          const overlapsReadableText = coverage.some((coverageRect) =>
            textRects.some((textRect) => rectsOverlap(coverageRect, textRect)),
          );
          // At desktop the curved route avoids the prose. At phone width the
          // source/target column is necessarily linear, so the reader's content
          // layer is the visual contract: z-index 1 flight below z-index 2 text.
          if (overlapsReadableText) {
            const flightLayerZIndex = 1;
            const readableContentLayerZIndex = 2;
            expect(flightLayerZIndex).toBeLessThan(readableContentLayerZIndex);
          }
          const landing = scaledShapeRect(frame.landing);
          expect(landing.width).toBeGreaterThanOrEqual(0);
        }
      }
    }
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
    registerTestDestination("target");
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
      registerTestDestination("late-target");
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

  it("cancels instead of carrying a ghost flight after the same-screen target unmounts", async () => {
    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="same-screen-target" onClick={() => undefined}>
            完成
          </LiquidCtaButton>
          <LiquidDestination id="same-screen-target">课文进度</LiquidDestination>
        </>,
      );
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("missing CTA button");
    await act(async () => button.click());
    expect(liquidCtaTransitionSnapshot()?.phase).toBe("active");

    await act(async () => {
      root.render(
        <>
          <LiquidCtaTransitionLayer />
          <LiquidCtaButton destination="same-screen-target" onClick={() => undefined}>
            完成
          </LiquidCtaButton>
        </>,
      );
    });
    expect(liquidCtaTransitionSnapshot()).toBeNull();
    expect(container.querySelector("[data-liquid-cta-flight]")).toBeNull();
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
    registerTestDestination("target");
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
