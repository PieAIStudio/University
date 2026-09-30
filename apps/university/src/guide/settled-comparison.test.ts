import { afterEach, describe, expect, it, vi } from "vitest";
import { settledComparison } from "./settled-comparison.js";

afterEach(() => vi.useRealTimers());
describe("comparison reads actual targets after the panel moves", () => {
  function setup(read: () => readonly string[]) {
    vi.useFakeTimers();
    const publish = vi.fn();
    const schedule = (run: () => void, delay: number) => {
      const timer = setTimeout(run, delay);
      return () => clearTimeout(timer);
    };
    const cancel = settledComparison({
      read,
      publish,
      schedule,
      afterLayout: (run) => schedule(run, 48),
    });
    return { publish, cancel };
  }
  it("does not freeze an empty read during re-projection into a permanent refusal", () => {
    let visible: readonly string[] = [];
    const { publish } = setup(() => visible);
    vi.advanceTimersByTime(300);
    expect(publish).not.toHaveBeenCalled();
    visible = ["island-a", "island-b"];
    vi.advanceTimersByTime(50);
    expect(publish).toHaveBeenCalledExactlyOnceWith(visible);
    vi.advanceTimersByTime(5000);
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it("finishes promptly for already visible islands", () => {
    const { publish } = setup(() => ["a", "b"]);
    vi.advanceTimersByTime(48);
    expect(publish).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
  });
  it("reports too few honestly at the deadline and leaves no timer", () => {
    const { publish } = setup(() => ["only-visible-island"]);
    vi.advanceTimersByTime(1600);
    expect(publish).toHaveBeenCalledExactlyOnceWith(["only-visible-island"]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a pending sample on account or map exit", () => {
    const { publish, cancel } = setup(() => []);
    vi.advanceTimersByTime(100);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(publish).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
