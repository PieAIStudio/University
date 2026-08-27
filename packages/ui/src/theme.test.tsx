// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryPersistence, createProgressPort } from "@pieai/university-core";

import { SettingsScreen } from "./navigation/empty/SettingsScreen.js";
import {
  applyThemePreference,
  resolvedThemeOf,
  SYSTEM_THEME_QUERY,
  watchThemePreference,
} from "./theme.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("theme resolution", () => {
  it("keeps explicit choices independent of the system", () => {
    expect(resolvedThemeOf("light", true)).toBe("light");
    expect(resolvedThemeOf("dark", false)).toBe("dark");
    expect(resolvedThemeOf("system", false)).toBe("light");
    expect(resolvedThemeOf("system", true)).toBe("dark");
  });

  it("applies the kit's light and night attributes", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    expect(applyThemePreference("light", document.documentElement)).toBe("light");
    expect(document.documentElement.dataset.gameUiTheme).toBe("light");
    expect(applyThemePreference("dark", document.documentElement)).toBe("dark");
    expect(document.documentElement.dataset.gameUiTheme).toBe("night");
  });

  it("derives browser chrome from the active kit surface token", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    document.documentElement.style.setProperty("--game-ui-bg", "rgb(243, 232, 216)");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    applyThemePreference("light", document.documentElement);

    expect(meta.content).toBe("rgb(243, 232, 216)");
    meta.remove();
    document.documentElement.style.removeProperty("--game-ui-bg");
  });

  it("listens only while the preference follows the system", () => {
    let listener: (() => void) | undefined;
    const media = {
      matches: false,
      media: SYSTEM_THEME_QUERY,
      addEventListener: vi.fn((_event: string, next: () => void) => {
        listener = next;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => media);

    const stop = watchThemePreference("system", document.documentElement);
    expect(document.documentElement.dataset.gameUiTheme).toBe("light");
    media.matches = true;
    listener?.();
    expect(document.documentElement.dataset.gameUiTheme).toBe("night");
    stop();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});

describe("theme settings", () => {
  it("writes an explicit theme through the existing progress preferences", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    await act(async () => root.render(<SettingsScreen progress={progress} />));

    const dark = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "深色",
    );
    expect(dark).toBeDefined();
    await act(async () => dark?.click());

    expect(progress.accountData().preferences.theme).toBe("dark");
    expect(dark?.getAttribute("aria-pressed")).toBe("true");
  });
});
