import { describe, expect, it } from "vitest";

import {
  createMedallionGeometry,
  MEDALLION_BODY_ALBEDO,
  MEDALLION_ENGRAVING_COLOURS,
  MEDALLION_FOOT_RADIUS,
  MEDALLION_HEIGHT,
  MEDALLION_SEGMENTS,
  MEDALLION_TOP_RADIUS,
  medallionPoseLocals,
  medallionTriangleCount,
} from "./lesson-medallion.js";

describe("Lesson medallion body", () => {
  it("is a round bevelled disc, not a hex, with a ~0.62-scale footprint of 1", () => {
    expect(MEDALLION_SEGMENTS).toBeGreaterThanOrEqual(12);
    expect(MEDALLION_SEGMENTS).toBeLessThanOrEqual(16);
    expect(MEDALLION_FOOT_RADIUS).toBe(1);
    expect(MEDALLION_TOP_RADIUS).toBeLessThan(MEDALLION_FOOT_RADIUS);
    expect(MEDALLION_HEIGHT).toBeGreaterThan(0.14);
    expect(MEDALLION_HEIGHT).toBeLessThan(0.28);
    const geometry = createMedallionGeometry();
    const position = geometry.getAttribute("position");
    let maxRadius = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < position.count; i += 1) {
      expect(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i))).toBe(true);
      maxRadius = Math.max(maxRadius, Math.hypot(position.getX(i), position.getZ(i)));
      minY = Math.min(minY, position.getY(i));
      maxY = Math.max(maxY, position.getY(i));
    }
    expect(maxRadius).toBeCloseTo(1, 3);
    expect(maxY - minY).toBeCloseTo(MEDALLION_HEIGHT, 3);
    expect(medallionTriangleCount(geometry)).toBeLessThan(400);
    geometry.dispose();
  });

  it("keeps the body pale and the engraving tinted by learner state, not a solid orange top", () => {
    const red = (colour: number) => (colour >> 16) & 255;
    const green = (colour: number) => (colour >> 8) & 255;
    const blue = (colour: number) => colour & 255;
    expect(red(MEDALLION_BODY_ALBEDO)).toBeGreaterThan(blue(MEDALLION_BODY_ALBEDO));
    expect(green(MEDALLION_BODY_ALBEDO)).toBeGreaterThan(100);
    const states = Object.values(MEDALLION_ENGRAVING_COLOURS);
    expect(new Set(states).size).toBe(4);
    expect(MEDALLION_ENGRAVING_COLOURS.live).not.toBe(MEDALLION_ENGRAVING_COLOURS.idle);
    expect(MEDALLION_ENGRAVING_COLOURS.idle).not.toBe(MEDALLION_ENGRAVING_COLOURS.done);
    expect(MEDALLION_ENGRAVING_COLOURS.done).not.toBe(MEDALLION_ENGRAVING_COLOURS.locked);
  });

  it("samples the same 14-sided rim the lathe emits", () => {
    const locals = medallionPoseLocals();
    const feet = locals.filter(
      (point) => point.role === "foot" && Math.hypot(point.x, point.z) > 0.2,
    );
    const tops = locals.filter(
      (point) => point.role === "top" && Math.hypot(point.x, point.z) > 0.2,
    );
    const chamfers = locals.filter((point) => point.role === "chamfer");
    expect(feet.length).toBeGreaterThanOrEqual(MEDALLION_SEGMENTS);
    expect(tops.length).toBe(MEDALLION_SEGMENTS);
    expect(chamfers.length).toBe(MEDALLION_SEGMENTS);
    expect(locals.every((point) => Number.isFinite(point.x + point.y + point.z))).toBe(true);
  });
});
