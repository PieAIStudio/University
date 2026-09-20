import { describe, expect, it } from "vitest";
import { hopPose, HOP_DURATION_MS } from "./avatar/hop.js";
import { mapTravelStartTime, recordMapTravel, type MapTravelClock } from "./map-travel-clock.js";

describe("viewport-local travel request", () => {
  it("keeps selection-to-commit time inside the existing journey", () => {
    const clock: MapTravelClock = { request: null };
    recordMapTravel(clock, "kind:lesson-2", 1000);
    expect(mapTravelStartTime(clock, "lesson-2", 1040)).toBe(1000);
    expect(
      hopPose({
        from: { x: 0, y: 0, z: 0 },
        to: { x: 2, y: 0, z: 0 },
        elapsedMs: 1040 - mapTravelStartTime(clock, "lesson-2", 1040),
      }).position.x,
    ).toBeGreaterThan(0);
    expect(HOP_DURATION_MS).toBe(420);
  });

  it("gives cloud and rider the same origin without consuming either's request", () => {
    const clock: MapTravelClock = { request: null };
    recordMapTravel(clock, "course-2", 1000);
    expect(mapTravelStartTime(clock, "course-2", 1035)).toBe(1000);
    expect(mapTravelStartTime(clock, "course-2", 1038)).toBe(1000);
    recordMapTravel(clock, "course-3", 1100);
    expect(mapTravelStartTime(clock, "course-2", 1120)).toBe(1120);
    expect(mapTravelStartTime(clock, "course-3", 1120)).toBe(1100);
  });

  it("does not borrow stale, future, missing or another viewport's input", () => {
    for (const at of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1501, 0]) {
      expect(mapTravelStartTime({ request: { key: "a", at } }, "a", 1500)).toBe(1500);
    }
    expect(mapTravelStartTime(null, "a", 1500)).toBe(1500);
    expect(mapTravelStartTime({ request: null }, "a", 1500)).toBe(1500);
    expect(mapTravelStartTime({ request: { key: "a", at: 1490 } }, null, 1500)).toBe(1500);
    expect(mapTravelStartTime({ request: { key: "a", at: 1490 } }, "b", 1500)).toBe(1500);
    const first: MapTravelClock = { request: null },
      second: MapTravelClock = { request: null };
    recordMapTravel(first, "a", 1490);
    expect(mapTravelStartTime(second, "a", 1500)).toBe(1500);
  });
});
