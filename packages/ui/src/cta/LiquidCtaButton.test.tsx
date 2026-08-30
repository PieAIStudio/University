// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiquidCtaButton } from "./LiquidCtaButton.js";

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
  vi.unstubAllGlobals();
});

async function renderButton() {
  await act(async () => {
    root.render(
      <LiquidCtaButton aria-label="开始学习" width="full">
        开始学习 →
      </LiquidCtaButton>,
    );
  });
  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) throw new Error("missing CTA button");
  return button;
}

function ctaState(): string | null {
  return container.querySelector<HTMLElement>("[data-liquid-cta]")?.dataset.liquidCtaState ?? null;
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
  it("keeps a clean zero-waviness silhouette behind a native button", async () => {
    const button = await renderButton();
    const surface = container.querySelector<HTMLElement>(".liquid-cta__surface");

    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("game-ui-button--static");
    expect(button.textContent).toBe("开始学习 →");
    expect(button.parentElement?.firstElementChild).toBe(surface);
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
    expect(button.parentElement?.firstElementChild).not.toBe(button);

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
