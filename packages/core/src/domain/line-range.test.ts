import { describe, expect, it } from "vitest";

import { formatLineRange } from "./line-range.js";

describe("formatLineRange", () => {
  it("writes a single line as one number", () => {
    expect(formatLineRange(8)).toBe("8");
    expect(formatLineRange(8, 8)).toBe("8");
  });

  it("writes a span with an en dash", () => {
    expect(formatLineRange(38, 43)).toBe("38–43");
  });

  /** A range whose end is missing or behind its start is a broken range, not a range backwards. */
  it("falls back to the start when the end cannot be trusted", () => {
    expect(formatLineRange(38, null)).toBe("38");
    expect(formatLineRange(38, undefined)).toBe("38");
    expect(formatLineRange(38, 12)).toBe("38");
  });
});
