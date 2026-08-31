import { describe, expect, it } from "vitest";

import { arcHeightFor, FAST_TRAVEL_UPPER_BOUND_MS, hopPose, HOP_DURATION_MS } from "./hop.js";

const FROM = { x: 0, y: 0, z: 0 };
const TO = { x: 4, y: 1, z: 3 };

describe("avatar hop", () => {
  it("publishes a measurable fast-travel budget above the shared hop duration", () => {
    expect(HOP_DURATION_MS).toBe(420);
    expect(FAST_TRAVEL_UPPER_BOUND_MS).toBe(540);
    expect(FAST_TRAVEL_UPPER_BOUND_MS).toBeGreaterThan(HOP_DURATION_MS);
  });

  it("starts on the node it left and finishes on the node it was sent to", () => {
    const start = hopPose({ from: FROM, to: TO, elapsedMs: 0 });
    expect(start.position).toEqual(FROM);

    const end = hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS });
    expect(end.position).toEqual(TO);
    expect(end.done).toBe(true);
  });

  /*
    A marker that settles a few centimetres off its stone reads as a bug for
    the rest of the session, so the landing is asserted exactly rather than
    within a tolerance.
  */
  it("lands exactly, however long the frame that overshot the end was", () => {
    const late = hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS * 9 });
    expect(late.position).toEqual(TO);
    expect(late.stretch).toBe(1);
  });

  it("leaves the ground in between and comes back to it", () => {
    const mid = hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS / 2 });
    expect(mid.lift).toBeGreaterThan(0);
    expect(mid.done).toBe(false);
    // The ground track itself never rises: only `lift` carries the arc, so a
    // ring drawn at `position` stays on the terrain the whole way across.
    expect(mid.position.y).toBeCloseTo(FROM.y + (TO.y - FROM.y) * 0.75, 6);
    expect(hopPose({ from: FROM, to: TO, elapsedMs: 0 }).lift).toBe(0);
    expect(hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS }).lift).toBe(0);
  });

  it("gives a learner who asked for less motion the destination, not the arc", () => {
    const pose = hopPose({ from: FROM, to: TO, elapsedMs: 1, reducedMotion: true });
    expect(pose.position).toEqual(TO);
    expect(pose.stretch).toBe(1);
    expect(pose.done).toBe(true);
  });

  it("scales the arc to the distance, so a neighbouring node is not a leap", () => {
    const near = arcHeightFor(FROM, { x: 0.2, y: 0, z: 0 });
    const far = arcHeightFor(FROM, { x: 40, y: 0, z: 0 });
    expect(near).toBeLessThan(far);
    expect(far).toBeLessThanOrEqual(1.6);
    expect(near).toBeGreaterThanOrEqual(0.35);
  });

  it("squashes at both contacts and stretches in the air", () => {
    const takeoff = hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS * 0.1 });
    const air = hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS * 0.5 });
    const landing = hopPose({ from: FROM, to: TO, elapsedMs: HOP_DURATION_MS * 0.95 });
    expect(takeoff.stretch).toBeLessThan(1);
    expect(air.stretch).toBeGreaterThan(1);
    expect(landing.stretch).toBeLessThan(1);
  });
});
