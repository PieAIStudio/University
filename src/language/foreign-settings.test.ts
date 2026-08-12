// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_FOREIGN_SETTINGS,
  FOREIGN_PRESETS,
  presetOf,
  readForeignSettings,
  writeForeignSettings,
} from "./foreign-settings.js";

describe("foreign-language presets", () => {
  // Storage persists across tests in one jsdom window, so a value written by an
  // earlier case would decide a later one.
  beforeEach(() => window.localStorage.clear());

  it("defaults to the least intrusive reading, so nothing changes for someone who never opens the panel", () => {
    expect(presetOf(DEFAULT_FOREIGN_SETTINGS)).toBe("read");
    expect(DEFAULT_FOREIGN_SETTINGS.showStageButtons).toBe(false);
  });

  it("makes the 记忆 preset withhold the Chinese, because that is what leaves the answer to be retrieved", () => {
    expect(FOREIGN_PRESETS.remember.showOriginal).toBe(false);
    expect(FOREIGN_PRESETS.remember.showStageButtons).toBe(true);
  });

  it("keeps the Chinese in both reading presets, because being stuck is the failure they avoid", () => {
    expect(FOREIGN_PRESETS.read.showOriginal).toBe(true);
    expect(FOREIGN_PRESETS.pronounce.showOriginal).toBe(true);
  });

  it("reports 自定义 once a switch no longer matches any preset", () => {
    expect(presetOf({ ...FOREIGN_PRESETS.remember, showOriginal: true })).toBe("custom");
  });

  it("round-trips through storage", () => {
    writeForeignSettings(FOREIGN_PRESETS.remember);
    expect(presetOf(readForeignSettings())).toBe("remember");
  });

  it("fills gaps from an older stored shape instead of yielding undefined fields", () => {
    window.localStorage.setItem(
      "university-local.foreign-settings",
      JSON.stringify({ showOriginal: false }),
    );
    const settings = readForeignSettings();
    expect(settings.showOriginal).toBe(false);
    // Absent from storage, so it takes today's default rather than undefined.
    expect(settings.showPhonetic).toBe(DEFAULT_FOREIGN_SETTINGS.showPhonetic);
    expect(settings.markStyle).toBe(DEFAULT_FOREIGN_SETTINGS.markStyle);
  });

  it("ignores a mark style that is not one of the three", () => {
    window.localStorage.setItem(
      "university-local.foreign-settings",
      JSON.stringify({ markStyle: "rainbow" }),
    );
    expect(readForeignSettings().markStyle).toBe(DEFAULT_FOREIGN_SETTINGS.markStyle);
  });

  it("survives corrupt storage rather than taking the lesson down", () => {
    window.localStorage.setItem("university-local.foreign-settings", "{not json");
    expect(readForeignSettings()).toEqual(DEFAULT_FOREIGN_SETTINGS);
  });
});
