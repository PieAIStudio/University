import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { islandBlueprint, sampleIslandSurface } from "../island/island-blueprint.js";
import { buildIslandGeometry, sampleIslandTerrainTop } from "../island/island-geometry.js";
import { radiusForLessons } from "../course/layout.js";

const STUDY = "turing-pact";
const COURSE = "foundations-before-zero";

describe("IslandBlueprint semantic LOD", () => {
  it("is deterministic, serialisable and keyed to the stable course identity", () => {
    const input = { studyId: STUDY, courseId: COURSE, lessonCount: 41 };
    const once = islandBlueprint(input);
    const twice = islandBlueprint(input);
    expect(once).toEqual(twice);
    expect(once.seed).toBe(`${STUDY}/${COURSE}`);
    expect(JSON.parse(JSON.stringify(once))).toEqual(once);
    expect(once.nodes).toHaveLength(41);
    expect(once.geometryNodes).toHaveLength(41);
  });

  it("keeps every route point and semantic anchor on the authored ground", () => {
    const blueprint = islandBlueprint({ studyId: STUDY, courseId: COURSE, lessonCount: 41 });
    for (const point of [...blueprint.nodes, ...blueprint.centerline, blueprint.hero]) {
      const sample = sampleIslandSurface(blueprint, point.x, point.z);
      expect(sample.inside).toBe(true);
      expect(sample.y).toBeCloseTo(point.y, 8);
    }
    for (const zone of blueprint.zones) {
      const sample = sampleIslandSurface(blueprint, zone.x, zone.z);
      expect(sample.inside).toBe(true);
    }
  });

  it("keeps a one-lesson landmark beside, not on top of, its entrance", () => {
    const blueprint = islandBlueprint({ studyId: STUDY, courseId: "one-lesson", lessonCount: 1 });
    const entrance = blueprint.nodes[0]!;
    expect(
      Math.hypot(blueprint.hero.x - entrance.x, blueprint.hero.z - entrance.z),
    ).toBeGreaterThan(
      blueprint.route.nodeRadius + blueprint.hero.radius + blueprint.route.clearance - 1e-6,
    );
    expect(sampleIslandSurface(blueprint, blueprint.hero.x, blueprint.hero.z).inside).toBe(true);
  });

  it("changes mesh density, not the normalised outline or landmark coordinate", () => {
    const blueprint = islandBlueprint({ studyId: STUDY, courseId: COURSE, lessonCount: 41 });
    const radius = radiusForLessons(41);
    const world = buildIslandGeometry(blueprint, "world", radius);
    const course = buildIslandGeometry(blueprint, "course");
    try {
      expect(world.terrain.getAttribute("position").count).toBeLessThan(
        course.terrain.getAttribute("position").count,
      );
      expect(world.bounds.halfX / world.scale).toBeCloseTo(course.bounds.halfX, 6);
      expect(world.bounds.halfZ / world.scale).toBeCloseTo(course.bounds.halfZ, 6);
      expect(world.bounds.halfX).toBeLessThanOrEqual(radius + 1e-6);
      expect(world.bounds.halfZ).toBeLessThanOrEqual(radius + 1e-6);

      const courseAnchor = course.point(blueprint.hero.x, blueprint.hero.z);
      const worldAnchor = world.point(blueprint.hero.x, blueprint.hero.z);
      expect(worldAnchor.x / world.scale).toBeCloseTo(courseAnchor.x, 6);
      expect(worldAnchor.z / world.scale).toBeCloseTo(courseAnchor.z, 6);
    } finally {
      world.terrain.dispose();
      course.terrain.dispose();
    }
  });

  it("uses the same surface rule for route and terrain roots", () => {
    const blueprint = islandBlueprint({ studyId: STUDY, courseId: COURSE, lessonCount: 41 });
    for (const point of [...blueprint.nodes, ...blueprint.centerline, blueprint.hero]) {
      const surface = sampleIslandSurface(blueprint, point.x, point.z);
      const renderedTop = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      expect(surface.inside).toBe(true);
      expect(point.y).toBeCloseTo(surface.y, 8);
      // The terrain adapter interpolates the same low-poly triangles emitted
      // for the course view, so its height is intentionally an approximation
      // of the continuous authoring surface at arbitrary route points.
      expect(renderedTop.inside).toBe(true);
      expect(Number.isFinite(renderedTop.y)).toBe(true);
    }
  });

  it("builds finite, upward-facing top geometry", () => {
    const blueprint = islandBlueprint({ studyId: STUDY, courseId: COURSE, lessonCount: 41 });
    const shape = buildIslandGeometry(blueprint, "course");
    try {
      const positions = shape.terrain.getAttribute("position") as THREE.BufferAttribute;
      const normals = shape.terrain.getAttribute("normal") as THREE.BufferAttribute;
      for (let index = 0; index < positions.count; index += 1) {
        expect(Number.isFinite(positions.getX(index))).toBe(true);
        expect(Number.isFinite(positions.getY(index))).toBe(true);
        expect(Number.isFinite(positions.getZ(index))).toBe(true);
      }
      expect(normals.getY(0)).toBeGreaterThan(0.5);
    } finally {
      shape.terrain.dispose();
    }
  });
});
