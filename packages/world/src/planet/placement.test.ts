import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  applyYawPitch,
  placeStudies,
  planetPoints,
  pointForStudy,
  rotationFor,
  stepRotation,
  type SpherePoint,
} from "./placement.js";

function angularGap(left: SpherePoint, right: SpherePoint): number {
  const dot = left.x * right.x + left.y * right.y + left.z * right.z;
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

function minGap(points: readonly SpherePoint[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      min = Math.min(min, angularGap(points[i]!, points[j]!));
    }
  }
  return min;
}

function unitLength(point: SpherePoint): number {
  return Math.hypot(point.x, point.y, point.z);
}

const FOUR = ["turing-pact", "buzz", "supaluv", "university-local"] as const;
const FORTY = Array.from(
  { length: 40 },
  (_, index) => `study-${index.toString().padStart(2, "0")}`,
);

describe("planetPoints", () => {
  it("puts N=4 and N=40 on the unit sphere without overlapping", () => {
    for (const count of [4, 40]) {
      const points = planetPoints(count);
      expect(points).toHaveLength(count);
      expect(points.every((point) => Math.abs(unitLength(point) - 1) < 1e-10)).toBe(true);
      // A marker of radius 0.04 occupies ~0.08 rad; stay well above that so
      // two islands never share a pixel even at N=40.
      expect(minGap(points)).toBeGreaterThan(count === 4 ? 0.9 : 0.18);
    }
  });

  it("is deterministic for a given count and seed, and the seed only yaws the set", () => {
    expect(planetPoints(8, 0.4)).toEqual(planetPoints(8, 0.4));
    const a = planetPoints(8, 0);
    const b = planetPoints(8, 0.7);
    // Renormalisation after the yaw shifts y by an ulp; the latitude is the
    // same packing, not a new one.
    a.forEach((point, index) => expect(point.y).toBeCloseTo(b[index]!.y, 12));
    expect(a[3]!.theta).not.toBe(b[3]!.theta);
  });
});

describe("pointForStudy / placeStudies", () => {
  it("keeps the single-id helper deterministic and the picker points in front", () => {
    expect(pointForStudy("buzz")).toEqual(pointForStudy("buzz"));
    expect(pointForStudy("buzz").z).toBeGreaterThan(0.6);
    expect(placeStudies(FOUR).get("buzz")?.z).toBeGreaterThan(0.9);
  });

  it("reflows a collection into a separated front-facing ring as it grows", () => {
    const five = [...placeStudies([...FOUR, "aigc-studio"]).values()];
    expect(five.every((point) => point.z > 0.9)).toBe(true);
    expect(minGap(five)).toBeGreaterThan(0.35);
  });

  it("does not key placement to array index: shuffling the input keeps the map", () => {
    const forward = placeStudies(FOUR);
    const reversed = placeStudies([...FOUR].reverse());
    for (const id of FOUR) {
      expect(reversed.get(id)).toEqual(forward.get(id));
    }
  });

  it("keeps N=4 real ids and N=40 generated ids from sitting on top of each other", () => {
    const four = [...placeStudies(FOUR).values()];
    const forty = [...placeStudies(FORTY).values()];
    expect(four.every((point) => Math.abs(unitLength(point) - 1) < 1e-10)).toBe(true);
    expect(forty.every((point) => Math.abs(unitLength(point) - 1) < 1e-10)).toBe(true);
    // Four real ids use a narrow front-facing ring; generated ids use the
    // larger cap but stay above the horizon so every entry remains findable.
    expect(four.every((point) => point.z > 0.9)).toBe(true);
    expect(forty.every((point) => point.z > 0.4)).toBe(true);
    expect(minGap(four)).toBeGreaterThan(0.35);
    expect(minGap(forty)).toBeGreaterThan(0.02);
  });
});

describe("rotationFor", () => {
  it("turns a study point to face +Z, which is where PlanetStage sits the camera", () => {
    for (const id of [...FOUR, ...FORTY.slice(0, 8)]) {
      const point = pointForStudy(id);
      const { yaw, pitch } = rotationFor(point);
      const facing = applyYawPitch(point, yaw, pitch);
      expect(facing.x).toBeCloseTo(0, 5);
      expect(facing.y).toBeCloseTo(0, 5);
      expect(facing.z).toBeCloseTo(1, 5);
      // Nested groups, not a single Euler: inner pitch, outer yaw. A
      // default XYZ Euler on one object was 2.5° off and would have left
      // the island beside the camera rather than on it.
      const inner = new THREE.Group();
      inner.rotation.x = pitch;
      const outer = new THREE.Group();
      outer.rotation.y = yaw;
      outer.add(inner);
      outer.updateMatrixWorld(true);
      const throughThree = new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(
        inner.matrixWorld,
      );
      expect(throughThree.x).toBeCloseTo(0, 5);
      expect(throughThree.y).toBeCloseTo(0, 5);
      expect(throughThree.z).toBeCloseTo(1, 5);
    }
  });
});

describe("stepRotation", () => {
  it("snaps when the learner asked for reduced motion, and damps otherwise", () => {
    const current = { yaw: 0, pitch: 0 };
    const target = { yaw: 1, pitch: -0.4 };
    expect(stepRotation(current, target, 1 / 60, true)).toEqual(target);
    const stepped = stepRotation(current, target, 1 / 60, false, 5.5);
    expect(stepped.yaw).toBeGreaterThan(0);
    expect(stepped.yaw).toBeLessThan(target.yaw);
    expect(stepped.pitch).toBeLessThan(0);
    expect(stepped.pitch).toBeGreaterThan(target.pitch);
  });

  it("takes the short way around the yaw wrap, so the globe does not spin the long way", () => {
    const stepped = stepRotation(
      { yaw: 3.1, pitch: 0 },
      { yaw: -3.1, pitch: 0 },
      1 / 60,
      false,
      5.5,
    );
    // 3.1 → -3.1 is a tiny step across ±π, not a trip through 0.
    expect(Math.abs(stepped.yaw - 3.1)).toBeLessThan(0.2);
  });
});
