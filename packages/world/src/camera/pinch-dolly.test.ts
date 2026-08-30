import { describe, expect, it } from "vitest";

import { pinchDollyArmed } from "./pinch-dolly";

describe("pinchDollyArmed", () => {
  it("ignores a two-finger pan whose span only jitters", () => {
    expect(pinchDollyArmed(72, 72, false)).toBe(false);
    expect(pinchDollyArmed(72, 74, false)).toBe(false);
    expect(pinchDollyArmed(72, 70, false)).toBe(false);
    expect(pinchDollyArmed(72, 72 * 1.1, false)).toBe(false);
  });

  it("arms after a real pinch, then stays armed", () => {
    expect(pinchDollyArmed(56, 56 * 1.2, false)).toBe(true);
    expect(pinchDollyArmed(56, 40, false)).toBe(true);
    expect(pinchDollyArmed(56, 57, true)).toBe(true);
  });

  it("does not arm from a missing span", () => {
    expect(pinchDollyArmed(0, 80, false)).toBe(false);
    expect(pinchDollyArmed(80, 0, false)).toBe(false);
  });
});
