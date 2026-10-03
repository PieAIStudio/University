import { describe, expect, it } from "vitest";
import type { View } from "@pieai/university-core";
import {
  isSplashEntry,
  rememberSplashVisit,
  splashPoints,
  splashProgress,
  splashVisit,
  SPLASH_VISIT_KEY,
} from "./splash-policy";

describe("V7 opening admission and measured progress", () => {
  it("always leads a first opening with why learning here differs from asking AI", () => {
    expect(splashPoints(0)).toEqual(["why", "prepared", "example"]);
    for (let visit = 0; visit < 12; visit++) {
      const points = splashPoints(visit);
      expect(points).toHaveLength(3);
      expect(new Set(points).size).toBe(3);
      expect(points).not.toContain("providers");
    }
    expect(splashPoints(1)).not.toEqual(splashPoints(0));
    expect(splashPoints(Number.NaN)).toEqual(splashPoints(0));
  });
  it("records only an optional presentation visit, and a denied store cannot lock entry", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(splashVisit(storage)).toBe(0);
    rememberSplashVisit(storage, 0);
    rememberSplashVisit(storage, 0); // React's effect rehearsal is not another visit.
    expect(splashVisit(storage)).toBe(1);
    expect([...data]).toEqual([[SPLASH_VISIT_KEY, "1"]]);
    for (const invalid of ["-1", "NaN", "1.5", "Infinity", "9007199254740992"]) {
      data.set(SPLASH_VISIT_KEY, invalid);
      expect(splashVisit(storage)).toBe(0);
    }
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(splashVisit(denied)).toBe(0);
    expect(() => rememberSplashVisit(denied, 0)).not.toThrow();
    expect(splashVisit(null)).toBe(0);
  });
  it("never reaches 100 percent before both actual data and the completed frame", () => {
    expect(splashProgress(false, 0, 0, false)).toBe(0);
    expect(splashProgress(true, 0, 4, false)).toBeCloseTo(1 / 3);
    expect(splashProgress(true, 2, 4, false)).toBe(0.5);
    expect(splashProgress(true, 4, 4, false)).toBeCloseTo(2 / 3);
    expect(splashProgress(false, 4, 4, true)).toBeLessThan(1);
    expect(splashProgress(true, 4, 4, true)).toBe(1);
    expect(splashProgress(true, Number.NaN, Number.NaN, false)).toBeCloseTo(1 / 3);
    expect(splashProgress(true, 999, 1, false)).toBeCloseTo(2 / 3);
  });
  it("covers a web map launch and reload, but not internal navigation or an auth/lesson deep link", () => {
    const world: View = { kind: "world" };
    const url = new URL("https://campus.example/?lang=en&utm_source=friend");
    expect(isSplashEntry(world, url)).toBe(true);
    expect(isSplashEntry(world, url, "https://outside.example/")).toBe(true);
    expect(isSplashEntry(world, url, "https://campus.example/lesson")).toBe(false);
    expect(isSplashEntry(world, url, "https://campus.example/lesson", "reload")).toBe(true);
    expect(isSplashEntry({ kind: "planet" }, new URL("https://campus.example/planet"))).toBe(true);
    expect(isSplashEntry({ kind: "me" }, url)).toBe(false);
    expect(isSplashEntry(world, new URL("https://campus.example/?code=auth"))).toBe(false);
    expect(isSplashEntry(world, new URL("https://campus.example/?seed=diagnostic"))).toBe(false);
    expect(isSplashEntry(world, new URL("https://campus.example/#access_token=not-a-token"))).toBe(
      false,
    );
  });
});
