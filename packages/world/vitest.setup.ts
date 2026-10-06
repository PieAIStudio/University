import { beforeEach } from "vitest";
import { setInterfaceLocale } from "@pieai/university-ui/i18n.js";

// Source-language assertions must not depend on the test host's locale.
// Language-specific tests override this deliberately inside their own case.
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
}
setInterfaceLocale("zh-CN");
beforeEach(() => setInterfaceLocale("zh-CN"));

// UIKit 3 measures its framed panels with ResizeObserver. jsdom has no layout
// engine; world tests assert the rendered contract, so a no-op observer is the
// complete test surface they need.
if (!("ResizeObserver" in globalThis)) {
  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    NoopResizeObserver;
}
