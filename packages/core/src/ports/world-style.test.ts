import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  parseAccountData,
  mergeAccountPreferences,
} from "./account-data.js";
describe("world appearance is one independent account preference", () => {
  it.each([undefined, null, "unknown", 1, {}, "diorama"])(
    "uses classic for legacy or malformed %j",
    (value) => {
      expect(parseAccountData({ preferences: { worldStyle: value } }).preferences.worldStyle).toBe(
        "classic",
      );
    },
  );
  it("parses clay without changing the saved avatar or UI theme", () => {
    const next = parseAccountData({
      preferences: { worldStyle: "clay", theme: "dark", avatarRecipe: "saved-identity" },
    }).preferences;
    expect(next.worldStyle).toBe("clay");
    expect(next.theme).toBe("dark");
    expect(next.avatarRecipe).toBe("saved-identity");
  });
  it("merges style and theme independently with their own clocks", () => {
    const a = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      worldStyle: "clay" as const,
      updatedAt: { worldStyle: "2026-09-18T12:00:00Z" },
    };
    const b = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      theme: "dark" as const,
      updatedAt: { theme: "2026-09-18T13:00:00Z" },
    };
    const merged = mergeAccountPreferences(a, b);
    expect(merged.worldStyle).toBe("clay");
    expect(merged.theme).toBe("dark");
    expect(merged.updatedAt.worldStyle).toBe(a.updatedAt.worldStyle);
    expect(mergeAccountPreferences(b, a)).toEqual(merged);
    expect(
      mergeAccountPreferences(merged, {
        ...b,
        worldStyle: "classic",
        updatedAt: { worldStyle: "2026-09-18T14:00:00Z" },
      }).worldStyle,
    ).toBe("classic");
  });
});
