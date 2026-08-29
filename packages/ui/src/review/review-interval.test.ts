import { describe, expect, it } from "vitest";

import { reviewIntervalLabel } from "./review-interval.js";

describe("reviewIntervalLabel", () => {
  it("uses a compact human interval for minutes, hours, and days", () => {
    expect(reviewIntervalLabel(60_000)).toBe("1 分钟");
    expect(reviewIntervalLabel(90 * 60_000)).toBe("2 小时");
    expect(reviewIntervalLabel(3 * 86_400_000)).toBe("3 天");
  });

  it("does not render a misleading zero or invalid interval", () => {
    expect(reviewIntervalLabel(1)).toBe("马上");
    expect(reviewIntervalLabel(0)).toBe("马上");
    expect(reviewIntervalLabel(Number.NaN)).toBe("马上");
  });
});
