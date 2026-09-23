import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  COURSE_ROCK_BANK_FACES,
  COURSE_ROCK_BANK_POINTS,
  COURSE_ROCK_BANK_TRIANGLES,
  createDressingBoulderGeometry,
  dressingBoulderAlternatives,
  kenneyStones,
} from "./course-rock-profile.js";
import { miniatureMetrics } from "./miniature-layout.js";

const point = (i: number) =>
  new THREE.Vector3(
    COURSE_ROCK_BANK_POINTS[i]!.x,
    COURSE_ROCK_BANK_POINTS[i]!.lift,
    COURSE_ROCK_BANK_POINTS[i]!.z,
  );

describe("course rocks (Kenney Nature Kit, R59-06)", () => {
  it("bakes five boulders, five spires and five small stones", () => {
    for (const set of ["boulder", "spire", "small"] as const)
      expect(kenneyStones(set), set).toHaveLength(5);
  });

  it("keeps the donor's outward winding, so a plant can only sit on a top", () => {
    // Kenney's rocks have overhangs whose undersides face down above the
    // middle, so no per-face test holds; each rock's signed volume does.
    const volume = new Map<number, number>();
    for (const [a, b, c] of COURSE_ROCK_BANK_FACES) {
      const mass = COURSE_ROCK_BANK_POINTS[a]!.mass;
      volume.set(mass, (volume.get(mass) ?? 0) + point(a).dot(point(b).cross(point(c))) / 6);
    }
    for (const [mass, value] of volume) expect(value, `mass ${mass}`).toBeGreaterThan(0);
  });

  it("stays inside the outcrop's unit reserve and its triangle budget", () => {
    for (const p of COURSE_ROCK_BANK_POINTS) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(1);
    expect(COURSE_ROCK_BANK_TRIANGLES).toBeLessThanOrEqual(360);
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
    for (const variant of ["large", "small", "stone"] as const)
      for (
        let alternative = 0;
        alternative < dressingBoulderAlternatives(variant);
        alternative += 1
      ) {
        const geometry = createDressingBoulderGeometry(variant, alternative);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const [hx, hz] = limits[variant];
        // Any turn: the footprint's radius must fit the smaller half-width.
        const position = geometry.getAttribute("position");
        let radius = 0;
        for (let i = 0; i < position.count; i += 1)
          radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)));
        expect(radius, `${variant}/${alternative}`).toBeLessThanOrEqual(Math.min(hx, hz) + 1e-6);
        expect(box.min.y, `${variant}/${alternative}`).toBeLessThan(0);
        geometry.dispose();
      }
  });
});
