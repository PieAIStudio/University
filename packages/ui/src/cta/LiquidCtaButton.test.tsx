// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiquidCtaButton, type LiquidCtaButtonProps } from "./LiquidCtaButton.js";
import {
  cancelLiquidCtaTransition,
  liquidCtaTransitionSnapshot,
  registerLiquidDestination,
} from "./LiquidCtaTransition.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  cancelLiquidCtaTransition();
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderButton(props: Partial<LiquidCtaButtonProps> = {}) {
  await act(async () => {
    root.render(
      <LiquidCtaButton aria-label="开始学习" fullWidth {...props}>
        开始学习 →
      </LiquidCtaButton>,
    );
  });
  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) throw new Error("missing CTA button");
  return button;
}

function ctaState(): string | null {
  const active = container.querySelector<HTMLElement>('[data-liquid-form="press"]')?.dataset
    .liquidActive;
  return active === "true" ? "pressed" : active === "false" ? "rest" : null;
}

function installMatchMedia(matches: boolean) {
  const media = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
}

describe("LiquidCtaButton", () => {
  it("captures the native source and starts the destination before the caller changes route", async () => {
    const target = document.createElement("div");
    target.getBoundingClientRect = () => new DOMRect(500, 100, 22, 22);
    const unregister = registerLiquidDestination("ordered-target", target);
    const observed: unknown[] = [];
    try {
      const button = await renderButton({
        destination: "ordered-target",
        onClick: (event) => {
          observed.push(liquidCtaTransitionSnapshot()?.destinationId);
          observed.push(liquidCtaTransitionSnapshot()?.source);
          // A route change may immediately move or remove the native source.
          event.currentTarget.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
        },
      });
      button.getBoundingClientRect = () => new DOMRect(24, 64, 132, 44);
      await act(async () => button.click());
      expect(observed).toEqual(["ordered-target", { x: 24, y: 64, width: 132, height: 44 }]);
      expect(liquidCtaTransitionSnapshot()?.source).toEqual({
        x: 24,
        y: 64,
        width: 132,
        height: 44,
      });
    } finally {
      unregister();
    }
  });

  it("preserves a cancelled click callback without starting a destination", async () => {
    const onClick = vi.fn();
    const button = await renderButton({
      destination: "cancelled-target",
      onClickCapture: (event) => event.preventDefault(),
      onClick,
    });
    button.getBoundingClientRect = () => new DOMRect(24, 64, 132, 44);
    await act(async () => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(liquidCtaTransitionSnapshot()).toBeNull();
  });

  it("keeps disabled native clicks from calling actions or starting a destination", async () => {
    const onClick = vi.fn();
    const button = await renderButton({ disabled: true, destination: "disabled-target", onClick });
    button.getBoundingClientRect = () => new DOMRect(24, 64, 132, 44);
    await act(async () => button.click());
    expect(button.disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    expect(liquidCtaTransitionSnapshot()).toBeNull();
  });

  it("forwards pointer cancellation and keyboard callbacks to the caller", async () => {
    const onPointerCancel = vi.fn();
    const onKeyDown = vi.fn();
    const button = await renderButton({ onPointerCancel, onKeyDown });
    await act(async () => {
      button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    });
    expect(ctaState()).toBe("pressed");
    await act(async () => button.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true })));
    expect(onPointerCancel).toHaveBeenCalledTimes(1);
    expect(ctaState()).toBe("rest");
    await act(async () =>
      button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " })),
    );
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(ctaState()).toBe("pressed");
  });
  it("delegates the glossy zero-waviness surface and full width to UIKit, behind native content", async () => {
    const button = await renderButton();
    const surface = container.querySelector<HTMLElement>(".game-ui-liquid-surface__body");

    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("game-ui-button--full-width");
    expect(button.textContent).toBe("开始学习 →");
    expect(surface?.contains(button)).toBe(false);
    expect(
      surface?.parentElement?.querySelector(".game-ui-liquid-surface__content")?.contains(button),
    ).toBe(true);
    expect(surface?.parentElement?.getAttribute("data-liquid-finish")).toBe("glossy");
    expect(surface?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[data-liquid-waviness="0"]')).not.toBeNull();
    expect(ctaState()).toBe("rest");
  });

  it("morphs only the visual layer while the pointer is down", async () => {
    const button = await renderButton();

    await act(async () => {
      button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    });
    expect(ctaState()).toBe("pressed");
    expect(container.querySelector("button")).toBe(button);
    expect(container.querySelector(".game-ui-liquid-surface__body")?.contains(button)).toBe(false);

    await act(async () => {
      button.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
    });
    expect(ctaState()).toBe("rest");
  });

  it("supports keyboard press feedback without replacing the focusable button", async () => {
    const button = await renderButton();
    button.focus();
    expect(document.activeElement).toBe(button);

    await act(async () => {
      button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
    });
    expect(ctaState()).toBe("pressed");

    await act(async () => {
      button.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }));
    });
    expect(ctaState()).toBe("rest");
  });

  it("stays completely static when reduced motion is requested", async () => {
    installMatchMedia(true);
    const button = await renderButton();

    await act(async () => {
      button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    });
    expect(ctaState()).toBe("rest");
    expect(container.querySelector('[data-liquid-motion="reduced"]')).not.toBeNull();
  });
});
