import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  BOULDER_TRIANGLES,
  COURSE_ROCK_BANK_FACES,
  COURSE_ROCK_BANK_POINTS,
  COURSE_ROCK_BANK_TRIANGLES,
  createDressingBoulderGeometry,
} from "./course-rock-profile.js";
import { miniatureMetrics } from "./miniature-layout.js";

const point = (i: number) =>
  new THREE.Vector3(
    COURSE_ROCK_BANK_POINTS[i]!.x,
    COURSE_ROCK_BANK_POINTS[i]!.lift,
    COURSE_ROCK_BANK_POINTS[i]!.z,
  );

describe("course boulders", () => {
  it("winds every face outward, so a plant can only sit on a top", () => {
    const masses = new Map<number, THREE.Vector3>();
    for (const [i, p] of COURSE_ROCK_BANK_POINTS.entries()) {
      const centre = masses.get(p.mass) ?? new THREE.Vector3();
      masses.set(p.mass, centre.add(point(i)));
    }
    const counts = new Map<number, number>();
    for (const p of COURSE_ROCK_BANK_POINTS) counts.set(p.mass, (counts.get(p.mass) ?? 0) + 1);
    for (const [mass, sum] of masses) sum.divideScalar(counts.get(mass)!);
    for (const [a, b, c] of COURSE_ROCK_BANK_FACES) {
      const normal = point(b)
        .sub(point(a))
        .cross(point(c).sub(point(a)));
      const centroid = point(a).add(point(b)).add(point(c)).divideScalar(3);
      const centre = masses.get(COURSE_ROCK_BANK_POINTS[a]!.mass)!;
      expect(normal.dot(centroid.sub(centre))).toBeGreaterThan(0);
    }
  });

  it("stays inside the outcrop's unit reserve and the triangle budget it replaced", () => {
    for (const p of COURSE_ROCK_BANK_POINTS) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(1);
    expect(COURSE_ROCK_BANK_TRIANGLES).toBeLessThanOrEqual(196);
    expect(COURSE_ROCK_BANK_TRIANGLES % BOULDER_TRIANGLES).toBe(0);
  });

  it("is a chunk, not a slab: every boulder at least half as tall as it is wide", () => {
    for (const mass of new Set(COURSE_ROCK_BANK_POINTS.map((p) => p.mass))) {
      const own = COURSE_ROCK_BANK_POINTS.filter((p) => p.mass === mass);
      const width = Math.max(...own.map((p) => p.x)) - Math.min(...own.map((p) => p.x));
      const height = Math.max(...own.map((p) => p.lift));
      expect(height / width, `mass ${mass}`).toBeGreaterThan(0.5);
    }
  });

  it("draws the roadside rocks inside the Kenney footprint they replace", () => {
    // Half-widths per unit height of rock_largeA and rock_smallA (their GLB bounds).
    // The ground stone keeps the miniature stone's own footprint radius.
    const stone = miniatureMetrics("stone").radius;
    const limits = { large: [1.51, 1.95], small: [0.94, 0.94], stone: [stone, stone] } as const;
    for (const variant of ["large", "small", "stone"] as const) {
      const geometry = createDressingBoulderGeometry(variant);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const [hx, hz] = limits[variant];
      // Any turn: the footprint's radius must fit the smaller half-width.
      const position = geometry.getAttribute("position");
      let radius = 0;
      for (let i = 0; i < position.count; i += 1)
        radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)));
      expect(radius, variant).toBeLessThanOrEqual(Math.min(hx, hz) * 1.0 + 1e-6);
      expect(box.min.y, variant).toBeLessThan(0);
      geometry.dispose();
    }
  });
});
