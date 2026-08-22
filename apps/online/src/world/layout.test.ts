import { describe, expect, it } from "vitest";

import { COURSE_STEP, layoutCourse } from "./layout";

describe("layoutCourse", () => {
  it("packs stones closer than a landscape of isolated discs", () => {
    const placed = layoutCourse([4, 4]);
    expect(placed).toHaveLength(8);
    const step = placed[0]!.z - placed[1]!.z;
    expect(step).toBeCloseTo(COURSE_STEP, 5);
    expect(step).toBeGreaterThan(3);
    expect(step).toBeLessThan(6);
  });

  it("still steps up at a unit boundary", () => {
    const placed = layoutCourse([4, 4]);
    const riseInside = placed[1]!.y - placed[0]!.y;
    const riseAcross = placed[4]!.y - placed[3]!.y;
    expect(riseAcross).toBeGreaterThan(riseInside);
  });
});
