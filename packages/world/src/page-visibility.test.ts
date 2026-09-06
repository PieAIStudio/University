// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { pageIsVisible, subscribePageVisibility } from "./page-visibility.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("world viewport document lifecycle", () => {
  it("pauses when hidden, resumes on visibility and removes its listener", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const onChange = vi.fn();
    const unsubscribe = subscribePageVisibility(onChange);
    expect(pageIsVisible()).toBe(true);
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(pageIsVisible()).toBe(false);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(pageIsVisible()).toBe(true);
    unsubscribe();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
