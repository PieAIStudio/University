// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NAVIGATION_FOCUS_KEY,
  readNavigationFocus,
  writeNavigationFocus,
} from "./navigation-focus.js";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.removeItem(NAVIGATION_FOCUS_KEY);
});

describe("tab-local navigation context", () => {
  it("stores only a route ID and can forget it", () => {
    writeNavigationFocus("turing-pact");
    expect(sessionStorage.getItem(NAVIGATION_FOCUS_KEY)).toBe("turing-pact");
    expect(readNavigationFocus()).toBe("turing-pact");
    writeNavigationFocus(undefined);
    expect(readNavigationFocus()).toBeUndefined();
  });

  it("rejects malformed stored values without treating them as paths", () => {
    sessionStorage.setItem(NAVIGATION_FOCUS_KEY, "../private");
    expect(readNavigationFocus()).toBeUndefined();
    sessionStorage.removeItem(NAVIGATION_FOCUS_KEY);
    writeNavigationFocus("../private");
    expect(sessionStorage.getItem(NAVIGATION_FOCUS_KEY)).toBeNull();
  });

  it("degrades without breaking navigation when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readNavigationFocus()).toBeUndefined();
    expect(() => writeNavigationFocus("turing-pact")).not.toThrow();
  });
});
