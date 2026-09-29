import { describe, expect, it } from "vitest";
import {
  COSMETIC_ORNAMENT_IDS,
  COSMETIC_ORNAMENT_RADIUS,
  cosmeticOrnamentGeometry,
  cosmeticOrnamentPlacement,
} from "./cosmetic-ornament.js";
import { COURSES, placements } from "./course-placements.fixture.js";
import {
  courseLearningSites,
  courseStandingFootprints,
  learningSiteExclusions,
} from "./learning-sites.js";
import { chestAndMonsterFootprints } from "./chests-and-monsters.js";
import { createIslandHeightSampler } from "../island/island-geometry.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";

it.each(COSMETIC_ORNAMENT_IDS)("%s stays inside one small, low-cost mesh", (id) => {
  const geometry = cosmeticOrnamentGeometry(id);
  const triangles = geometry.getAttribute("position").count / 3;
  expect(triangles).toBeLessThanOrEqual(240);
  expect(geometry.groups).toHaveLength(0);
  const box = geometry.boundingBox!;
  expect(
    Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)),
  ).toBeLessThan(COSMETIC_ORNAMENT_RADIUS);
  expect(box.max.y).toBeLessThan(1);
  expect(geometry.getAttribute("color").count).toBe(geometry.getAttribute("position").count);
  console.log(`${id}: ${triangles} triangles, 1 draw, no textures`);
  geometry.dispose();
});
describe("an equipped ornament fits existing ground, rather than changing it", () => {
  for (const [study, course, units] of COURSES)
    it(`${study}/${course}`, () => {
      const lessons = placements(study, course, units),
        blueprint = lessons[0]!.blueprint;
      const sites = courseLearningSites(lessons);
      const obstacles = [
        ...courseStandingFootprints(blueprint).map((p) => ({ x: p.x, z: p.z, radius: p.r })),
        ...learningSiteExclusions(sites),
        ...chestAndMonsterFootprints(lessons, sites),
        ...lessons.map((l) => ({
          x: l.position.x,
          z: l.position.z,
          radius: blueprint.route.nodeRadius + 0.12,
        })),
      ];
      const before = JSON.stringify(blueprint);
      const position = cosmeticOrnamentPlacement(blueprint, lessons[0]!.position, obstacles);
      expect(position).not.toBeNull();
      expect(cosmeticOrnamentPlacement(blueprint, lessons[0]!.position, obstacles)).toEqual(
        position,
      );
      for (const obstacle of obstacles)
        expect(
          Math.hypot(position!.x - obstacle.x, position!.z - obstacle.z),
        ).toBeGreaterThanOrEqual(obstacle.radius + COSMETIC_ORNAMENT_RADIUS + 0.12);
      expect(distanceToIslandRoute(blueprint, position!)).toBeGreaterThanOrEqual(
        blueprint.route.roadWidth / 2 + COSMETIC_ORNAMENT_RADIUS + 0.12,
      );
      const ground = createIslandHeightSampler(blueprint);
      try {
        expect(position!.y).toBeCloseTo(ground.heightAt(position!.x, position!.z).y, 6);
      } finally {
        ground.dispose();
      }
      expect(JSON.stringify(blueprint)).toBe(before);
      expect(
        cosmeticOrnamentPlacement(blueprint, lessons[0]!.position, [{ x: 0, z: 0, radius: 1000 }]),
      ).toBeNull();
    });
});
